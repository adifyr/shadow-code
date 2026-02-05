import {readFileSync} from "fs";
import {join} from "path";
import {CancellationTokenSource, ConfigurationTarget, env, LanguageModelChat, LanguageModelChatMessage, lm, Position, Range, Uri, ViewColumn, window, workspace, WorkspaceConfiguration} from "vscode";
import {buildDiff} from "../utils/diff_builder";
import {Logger} from "../utils/logger";
import {getLanguageHandler} from "./handler_interface";

export class AIService {
  private config: WorkspaceConfiguration;

  constructor(private extensionPath: string) {
    this.config = workspace.getConfiguration("ShadowCode");
  }

  async convertShadowCode(
    langExtName: string,
    oldPseudocode: string | undefined,
    pseudocode: string,
    existingCode: string,
    originalFileUri: Uri,
  ): Promise<boolean> {
    const [systemPrompt, rawUserPrompt] = this.getPrompts(langExtName);
    const diff = buildDiff(oldPseudocode, pseudocode);
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
    return output !== undefined;
  }

  private async generateCode(systemPrompt: string, userPrompt: string, fileUri: Uri): Promise<string | undefined> {
    const model = await this.selectModel(this.config.get<string>("modelId"));
    if (!model) {return;}
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
    let output = "";
    try {
      for await (const fragment of response.text) {
        output += fragment;
        await originalFileEditor.edit((edit) => {
          const lastLine = originalFileEditor.document.lineAt(originalFileEditor.document.lineCount - 1);
          const position = new Position(lastLine.lineNumber, lastLine.text.length);
          edit.insert(position, fragment);
        });
      }
    } catch (err) {
      const error = err as Error;
      if (error.message.includes("filtered")) {
        window.showErrorMessage(
          "Shadow Code: AI Response has been blocked by Github's 'Public Code' filter. Go to your Copilot settings on the GitHub website and set 'Suggestions matching public code' (under Privacy) to 'Allowed'.",
          "Go To Copilot Settings On Github",
        ).then((value) => {
          if (value === "Go To Copilot Settings On Github") {
            env.openExternal(Uri.parse("https://github.com/settings/copilot/features"));
          }
        });
      }
      Logger.error(`Error Streaming AI Response: ${error.message} | Using Model: ${model.name}`, error.stack);
      await originalFileEditor.edit((edit) => {
        const doc = originalFileEditor.document;
        edit.delete(new Range(doc.positionAt(0), doc.positionAt(doc.getText().length)));
        edit.insert(originalFileEditor.selection.active, `// ${error.message}`);
      });
      cancellationSource.dispose();
      return;
    } finally {
      cancellationSource.dispose();
    }
    output = output.replace(/^[\s\n]*```[a-z]*\n?|(?:\n?```[\s\n]*)$/gi, "").trim();
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

  async selectModel(modelId?: string): Promise<LanguageModelChat | undefined> {
    const models = await lm.selectChatModels({...(modelId && {id: modelId})});
    if (models.length === 1) {
      return models[0];
    } else if (models.length === 0) {
      window.showErrorMessage("No AI Models found. Please install a model provider (Example: Github Copilot).");
      return;
    }
    const selection = await window.showQuickPick(models.map((model) => model.name), {
      title: "Select AI Model for Shadow Code",
      prompt: "Select an AI model to handle the code generation for Shadow Code. 'Auto' can't be used by extensions.",
      canPickMany: false,
    });
    if (!selection) {
      window.showWarningMessage("No model selected. Unable to proceed with Shadow Code Conversion.");
      return;
    }
    const model = models.find((model) => model.name === selection)!;
    if (model.id === "auto") {
      window.showWarningMessage(
        "Shadow Code: 'Auto' is an internal setting and can't be used by extensions. Please select a specific model."
      );
      return;
    }
    this.config.update("modelId", model.id, ConfigurationTarget.Global);
    window.showInformationMessage(`AI Model selected for Shadow Code: ${model.name}`);
    return model;
  }
}