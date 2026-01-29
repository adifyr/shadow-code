import {OpenRouter} from "@openrouter/sdk";
import {readFileSync} from "fs";
import {join} from "path";
import {TextDecoder} from "util";
import {Uri, window, workspace} from "vscode";

export class ShadowCodeService {
  constructor(private extensionPath: string, private model: string, private client: OpenRouter) { }

  static initialize(extPath: string): ShadowCodeService | undefined {
    const config = workspace.getConfiguration("shadowCodeAI");
    const apiKey = config.get<string>("apiKey");
    if (!apiKey) {
      window.showErrorMessage("Error: Your OpenRouter API Key is not configured.");
      return;
    }
    return new ShadowCodeService(extPath, config.get<string>("model")!, new OpenRouter({apiKey}));
  }

  async generateCode(
    langExtName: string = "default",
    pseudocode: string,
    existingCode: string,
    originalFileUri: Uri,
    diff: string,
  ): Promise<string | undefined> {
    const systemPrompt = readFileSync(join(this.extensionPath, `assets/prompts/${langExtName}/system_prompt.md`), "utf-8")
      .replaceAll("{{language}}", langExtName);
    const workspaceUri = workspace.getWorkspaceFolder(originalFileUri)!.uri;
    const context = await this.extractContext(pseudocode, workspaceUri);
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
    } else if (langExtName === "ts") {
      const packageJsonUris = await workspace.findFiles("package.json", "**/node_modules/**");
      const packageJson = packageJsonUris.length > 0 ?
        textDecoder.decode(await workspace.fs.readFile(packageJsonUris[0])) :
        "";
      const tsconfigUris = await workspace.findFiles("tsconfig.json", "**/node_modules/**");
      const tsconfig = tsconfigUris.length > 0 ? textDecoder.decode(await workspace.fs.readFile(tsconfigUris[0])) : "";
      userPrompt = userPrompt.replace("{{package_json}}", packageJson).replace("{{tsconfig}}", tsconfig);
    } else if (langExtName === "js") {
      const packageJsonUris = await workspace.findFiles("package.json", "**/node_modules/**");
      const packageJson = packageJsonUris.length > 0 ?
        textDecoder.decode(await workspace.fs.readFile(packageJsonUris[0])) :
        "";
      userPrompt = userPrompt.replace("{{package_json}}", packageJson);
    }
    const result = this.client.callModel({
      model: this.model,
      instructions: systemPrompt,
      input: userPrompt,
      reasoning: {enabled: false},
    });
    const response = (await result.getText()).replace(/```[\w]*\n/g, '').replace(/```/g, '').trim();
    return response;
  }

  private async extractContext(pseudocode: string, workspaceUri: Uri): Promise<string> {
    const useBlocks = [...pseudocode.matchAll(/use\s*\(([^)]+)\)/gs)];
    const allPaths = useBlocks.flatMap((block) => [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
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