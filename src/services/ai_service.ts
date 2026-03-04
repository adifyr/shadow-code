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
    const handler = getLanguageHandler(langExtName);
    const configLists = await Promise.all(handler.configOptions.map(async (option) => {
      return {option, uris: await workspace.findFiles(`**/${option}`)};
    }));
    let config: {name: string; uri: Uri; data: string} | undefined;
    for (const list of configLists) {
      if (list.uris.length > 0) {
        const uri = list.uris[0];
        config = {name: list.option, uri, data: (await workspace.openTextDocument(uri)).getText()};
        break;
      }
    }
    const systemPrompt = readFileSync(join(this.extensionPath, "assets/prompts", "system.md"), "utf-8")
      .replaceAll("{{language}}", handler.language)
      .replaceAll("{{config}}", config?.name ?? "Config");
    const context = await this.extractContext(pseudocode, workspace.getWorkspaceFolder(originalFileUri)!.uri);
    const userPrompt = readFileSync(join(this.extensionPath, "assets/prompts", "user.md"), "utf-8")
      .replaceAll("{{language}}", handler.language)
      .replaceAll("{{config}}", config?.name ?? "Config")
      .replace("{{config_data}}", config?.data ?? "NA")
      .replace("{{pseudocode}}", buildDiff(oldPseudocode, pseudocode))
      .replace("{{existing_code}}", existingCode)
      .replace("{{context}}", context);
    const prefURIs = await workspace.findFiles(`.shadows/.skills/${handler.language.toUpperCase()}.md`);
    const skillsPrompt = prefURIs.length > 0 ? (await workspace.openTextDocument(prefURIs[0])).getText() : undefined;
    const output = await this.generateCode(systemPrompt, userPrompt, skillsPrompt, originalFileUri);
    if (config?.uri && output && config.data.length > 0) {
      console.log("Config Found. Checking for missing dependencies...");
      handler.addMissingDependencies(config.uri, config.data, output);
    }
    return !!output;
  }

  private async generateCode(
    systemPrompt: string,
    userPrompt: string,
    skillsPrompt: string | undefined,
    fileUri: Uri
  ): Promise<string | undefined> {
    const model = await this.selectModel(this.config.get<string>("modelId"));
    if (!model) {return;}
    const cancellationSource = new CancellationTokenSource();
    const response = await model.sendRequest([
      LanguageModelChatMessage.User(systemPrompt),
      ...(skillsPrompt ? [LanguageModelChatMessage.User(skillsPrompt)] : []),
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
    }, {undoStopBefore: true, undoStopAfter: false});
    let output = "";
    try {
      for await (const fragment of response.text) {
        output += fragment;
        await originalFileEditor.edit((edit) => {
          const lastLine = originalFileEditor.document.lineAt(originalFileEditor.document.lineCount - 1);
          const position = new Position(lastLine.lineNumber, lastLine.text.length);
          edit.insert(position, fragment);
        }, {undoStopBefore: false, undoStopAfter: false});
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
      }, {undoStopBefore: false, undoStopAfter: true});
      cancellationSource.dispose();
      return;
    } finally {
      cancellationSource.dispose();
    }
    output = output.replace(/^[\s\n]*```[a-z]*\n?|(?:\n?```[\s\n]*)$/gi, "").trim();
    await originalFileEditor.edit((edit) => {
      const doc = originalFileEditor.document;
      edit.replace(new Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), output);
    }, {undoStopBefore: false, undoStopAfter: true});
    await originalFileEditor.document.save();
    return output;
  }

  private async extractContext(pseudocode: string, workspaceUri: Uri): Promise<string> {
    const importBlocks = [...pseudocode.matchAll(/import\s*\(([^)]+)\)/gs)];
    const allPaths = importBlocks.flatMap((block) => [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
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