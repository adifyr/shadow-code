import {diffLines} from "diff";
import {readFile, readFileSync} from "fs";
import {join} from "path";
import {CancellationTokenSource, commands, ConfigurationTarget, ExtensionContext, LanguageModelChat, LanguageModelChatMessage, LanguageModelChatToolMode, lm, Position, Range, Uri, ViewColumn, window, workspace, WorkspaceConfiguration} from "vscode";
import {getLanguageHandler, ILanguageHandler} from "./handler_interface";
import DartHandler from "./dart_handler";
import {Logger} from "../utils/logger";

export class AIService {
  private workspaceConfig: WorkspaceConfiguration;
  private modelId: string | undefined;

  constructor(private extensionPath: string) {
    this.workspaceConfig = workspace.getConfiguration("ShadowCodeAI");
    this.modelId = this.workspaceConfig.get<string>("modelId");
  }

  async convertShadowCode(
    langExtName: string,
    oldPseudocode: string | undefined,
    pseudocode: string,
    existingCode: string,
    originalFileUri: Uri,
  ) {
    const [systemPrompt, rawUserPrompt] = this.getPrompts(langExtName);
    const diff = this.buildDiff(oldPseudocode, pseudocode);
    const context = await this.extractContext(pseudocode, workspace.getWorkspaceFolder(originalFileUri)!.uri);
    const baseUserPrompt = rawUserPrompt
      .replace("{{pseudocode}}", diff)
      .replace("{{existing_code}}", existingCode)
      .replace("{{context}}", context);
    const handler = getLanguageHandler(langExtName);
    const {userPrompt, configFileUri, config} = await handler.buildUserPrompt(baseUserPrompt);
    const output = await this.generateCode(systemPrompt, userPrompt, originalFileUri);
    if (configFileUri && output && config.length > 0) {
      handler.addMissingDependencies(configFileUri, config, output);
    }
  }

  private async generateCode(systemPrompt: string, userPrompt: string, fileUri: Uri): Promise<string | undefined> {
    const models = await lm.selectChatModels({...(this.modelId && {id: this.modelId})});
    if (models.length === 0) {
      window.showErrorMessage("No LLM Models found. Please install a model provider (Example: Github Copilot).");
      return;
    }
    let model: LanguageModelChat;
    if (models.length > 1) {
      const selection = await window.showQuickPick(models.map((model) => model.name), {
        title: "Select Model for Shadow Code AI",
        prompt: "Pick a model to handle the code generation for Shadow Code AI.",
        canPickMany: false,
      });
      if (!selection) {
        window.showWarningMessage("No model selected. Unable to proceed with Shadow Code Conversion.");
        return;
      }
      model = models.find((m) => m.name === selection)!;
      Logger.info(`Selected Model ID: ${model.id}`);
      await this.workspaceConfig.update("modelId", model.id, true);
      window.showInformationMessage(`Model for Shadow Code AI set to ${model.name}`);
    } else {
      model = models[0];
    }
    const cancellationSource = new CancellationTokenSource();
    const response = await model.sendRequest([
      LanguageModelChatMessage.User(systemPrompt),
      LanguageModelChatMessage.User(userPrompt),
    ], {}, cancellationSource.token);
    let originalFileEditor = window.visibleTextEditors.find((editor) => {
      return editor.document.uri.toString() === fileUri.toString();
    });
    if (!originalFileEditor) {
      originalFileEditor = await window.showTextDocument(await workspace.openTextDocument(fileUri), ViewColumn.Beside);
    }
    await originalFileEditor.edit((edit) => {
      const doc = originalFileEditor.document;
      edit.delete(new Range(doc.positionAt(0), doc.positionAt(doc.getText().length)));
    });
    const fragments: string[] = [];
    try {
      for await (const fragment of response.text) {
        fragments.push(fragment);
        await originalFileEditor.edit((edit) => {
          const lastLine = originalFileEditor.document.lineAt(originalFileEditor.document.lineCount - 1);
          const position = new Position(lastLine.lineNumber, lastLine.text.length);
          edit.insert(position, fragment);
        });
      }
    } catch (err) {
      const error = (err as Error).message;
      Logger.info(`Error editing fragments: ${error}`);
      await originalFileEditor.edit((edit) => {
        const lastLine = originalFileEditor.document.lineAt(originalFileEditor.document.lineCount - 1);
        const position = new Position(lastLine.lineNumber, lastLine.text.length);
        edit.insert(position, error);
      });
      return;
    } finally {
      cancellationSource.dispose();
    }
    const output = fragments.join('').trim().replace(/^```[a-z]*\n/i, "").replace(/\n```$/, "").trim();
    await originalFileEditor.edit((edit) => {
      const doc = originalFileEditor.document;
      edit.replace(new Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), output);
    });
    await originalFileEditor.document.save();
    return output;
  }

  private getPrompts = (langExtname: string): string[] => ["system", "user"].map((type) => {
    const prompt = readFileSync(join(this.extensionPath, `assets/prompts/${langExtname}/${type}_prompt.md`), "utf-8");
    return prompt.replaceAll("{{language}}", langExtname);
  });


  private buildDiff(oldText: string | undefined, newText: string): string {
    const contextRegex = /^\s*context\(.*?\)(\r?\n|$)/gm;
    const oldTextRefined = oldText?.replace(contextRegex, "").trimEnd();
    const newTextRefined = newText.replace(contextRegex, "").trimEnd();
    if (!oldTextRefined) {
      return newTextRefined.split(/\r?\n/).map((line) => `+ ${line}`).join("\n");
    }
    const changes = diffLines(oldTextRefined, newTextRefined);
    const lineDiffs: string[] = [];
    for (const change of changes) {
      const prefix = change.added ? "+ " : (change.removed ? "- " : "  ");
      const lines = change.value.split(/\r?\n/);
      lineDiffs.push(...lines.map((line) => `${prefix}${line}`));
    }
    return lineDiffs.join('\n').trim();
  }

  private async extractContext(pseudocode: string, workspaceUri: Uri): Promise<string> {
    const contextBlocks = [...pseudocode.matchAll(/context\s*\(([^)]+)\)/gs)];
    const allPaths = contextBlocks.flatMap((block) => [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
    const fileResults = await Promise.all(allPaths.map(async (path) => {
      try {
        const contentBuffer = await workspace.fs.readFile(Uri.joinPath(workspaceUri, path));
        const content = new TextDecoder().decode(contentBuffer);
        return {path, content};
      } catch (error) {
        console.error(`Failed to read file: ${path}`, error);
        return null;
      }
    }));
    const context = fileResults.filter((item) => item !== null).reduce((acc, item) => {
      return acc + `**${item.path}:**\n\`\`\`\n${item.content}\n\`\`\`\n\n`;
    }, "").trim();
    return context;
  }
}