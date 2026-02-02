import {GoogleGenAI} from "@google/genai";
import {readFileSync} from "fs";
import {join} from "path";
import {TextDecoder} from "util";
import {Range, Uri, window, workspace, WorkspaceEdit} from "vscode";
import {Logger} from "./utils/logger";

export class ShadowCodeService {
  constructor(private extensionPath: string, private model: string, private client: GoogleGenAI) {
    Logger.info("Model Name: " + model);
  }

  static initialize(extensionPath: string): ShadowCodeService | undefined {
    const config = workspace.getConfiguration("shadowCodeAI");
    const apiKey = config.get<string>("apiKey");
    if (!apiKey || apiKey.length === 0) {
      window.showErrorMessage("Error: Your OpenRouter API Key is not configured.");
      return;
    }
    Logger.info(`API Key: ${apiKey}`);
    return new ShadowCodeService(extensionPath, config.get<string>("model")!, new GoogleGenAI({apiKey}));
  }

  async handleDartGeneration(originalFileUri: Uri, systemPrompt: string, baseUserPrompt: string) {
    const pubspecUris = await workspace.findFiles("pubspec.yaml");
    const pubspec = pubspecUris.length > 0 ? await workspace.openTextDocument(pubspecUris[0]) : undefined;
    const userPrompt = baseUserPrompt.replace("{{pubspec}}", pubspec?.getText() ?? "");
    const output = await this.generateCode(systemPrompt, userPrompt);
    if (output) {
      const edit = new WorkspaceEdit();
      edit.replace(originalFileUri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), output);
      await workspace.applyEdit(edit);
    }
  }

  async generateCode_Old(
    langExtName: string = "default",
    pseudocode: string,
    existingCode: string,
    originalFileUri: Uri,
    diff: string,
  ): Promise<{code: string | undefined, config?: string, configUri?: Uri}> {
    const systemPrompt = readFileSync(
      join(this.extensionPath, `assets/prompts/${langExtName}/system_prompt.md`), "utf-8"
    ).replaceAll("{{language}}", langExtName);
    const context = await this.extractContext(pseudocode, workspace.getWorkspaceFolder(originalFileUri)!.uri);
    let config: string | undefined;
    let configUri: Uri | undefined;
    let userPrompt = readFileSync(join(this.extensionPath, `assets/prompts/${langExtName}/user_prompt.md`), "utf-8")
      .replace("{{pseudocode}}", diff)
      .replace("{{existing_code}}", existingCode)
      .replace("{{context}}", context)
      .replaceAll("{{language}}", langExtName);
    const textDecoder = new TextDecoder();
    if (langExtName === "dart") {
      const pubspecUris = await workspace.findFiles("pubspec.yaml");
      const pubspec = pubspecUris.length > 0 ? textDecoder.decode(await workspace.fs.readFile(pubspecUris[0])) : "";
      userPrompt = userPrompt.replace("{{pubspec}}", pubspec);
      config = pubspec;
      configUri = pubspecUris[0];
    } else if (langExtName === "ts") {
      const packageJsonUris = await workspace.findFiles("**/package.json", "**/node_modules/**");
      Logger.info("Found URIs for package.json:\n" + packageJsonUris.map((uri) => uri.toString()).toString());
      const packageJson = packageJsonUris.length > 0 ?
        textDecoder.decode(await workspace.fs.readFile(packageJsonUris[0])) :
        "";
      const tsconfigUris = await workspace.findFiles("**/tsconfig.json", "**/node_modules/**");
      const tsconfig = tsconfigUris.length > 0 ? textDecoder.decode(await workspace.fs.readFile(tsconfigUris[0])) : "";
      userPrompt = userPrompt.replace("{{package_json}}", packageJson).replace("{{tsconfig}}", tsconfig);
    } else if (langExtName === "js") {
      const packageJsonUris = await workspace.findFiles("**/package.json", "**/node_modules/**");
      const packageJson = packageJsonUris.length > 0 ?
        textDecoder.decode(await workspace.fs.readFile(packageJsonUris[0])) :
        "";
      userPrompt = userPrompt.replace("{{package_json}}", packageJson);
    }
    Logger.info(`User Prompt:\n${userPrompt}`);
    const result = await this.client.models.generateContent({
      model: this.model,
      contents: userPrompt,
      config: {systemInstruction: systemPrompt}
    });
    const response = result.text?.replace(/```[\w]*\n/g, '').replace(/```/g, '').trim();
    Logger.info(`AI Response:\n${response}`);
    return {code: response, config, configUri};
  }

  private async generateCode(systemPrompt: string, userPrompt: string): Promise<string | undefined> {
    Logger.info(`User Prompt:\n${userPrompt}`);
    const result = await this.client.models.generateContent({
      model: this.model,
      contents: userPrompt,
      config: {systemInstruction: systemPrompt},
    });
    const response = result.text?.replace(/```[\w]*\n/g, "").replace(/```/g, "").trim();
    Logger.info(`AI Response:\n${response}`);
    return response;
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