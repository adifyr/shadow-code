import {OpenRouter} from "@openrouter/sdk";
import {readFileSync} from "fs";
import {join} from "path";
import {Uri, window, workspace, WorkspaceConfiguration} from "vscode";

export class ShadowCodeService {
  private client: OpenRouter;
  private model: string;

  constructor(private extension_path: string, config: WorkspaceConfiguration, api_key: string) {
    this.model = config.get<string>("model")!;
    this.client = new OpenRouter({apiKey: api_key});
  }

  static initialize(extension_path: string): ShadowCodeService | undefined {
    const config = workspace.getConfiguration("shadowCodeAI");
    const api_key = config.get<string>("apiKey");
    if (!api_key) {
      window.showErrorMessage("Error: Your OpenRouter API Key is not configured.");
      return;
    }
    return new ShadowCodeService(extension_path, config, api_key);
  }

  async generate_code(lang_ext_name: string, pseudocode: string, existing_code: string): Promise<string | undefined> {
    const [system_prompt, user_prompt] = await this.get_prompts(lang_ext_name, pseudocode, existing_code);
    const result = this.client.callModel({
      model: this.model,
      instructions: system_prompt,
      input: user_prompt,
      temperature: 0,
      reasoning: {enabled: false},
    });
    const response = (await result.getText()).replace(/```[\w]*\n/g, '').replace(/```/g, '').trim();
    return response;
  }

  private async extract_context(lang_ext_name: string, pseudocode: string): Promise<string> {
    const context_files: {path: string, content: string}[] = [];
    const match = /use\s*\((.*?)\)/gs.exec(pseudocode);
    if (match && match.length > 1) {
      const paths = [...match[1].matchAll(/"([^"]+)"/g)].map((i) => i[1]);
      const workspace_folder = workspace.workspaceFolders?.[0];
      if (workspace_folder) {
        for (const path of paths) {
          try {
            const file_uri = Uri.joinPath(workspace_folder.uri, path);
            const content = (await workspace.openTextDocument(file_uri)).getText();
            context_files.push({path, content});
          } catch (error) {
            console.error(`Failed to read file: ${path}`, error);
          }
        }
      }
    }
    const context = context_files.reduce((_, item, __) => {
      return `**${item.path}:**\n\`\`\`${lang_ext_name}\n${item.content}\n\`\`\`\n\n`;
    }, "").trim();
    return context;
  }

  private async get_prompts(
    lang_ext_name: string = "default",
    pseudocode: string,
    existing_code: string
  ): Promise<[string, string]> {
    const [raw_system_prompt, raw_user_prompt] = [
      readFileSync(join(this.extension_path, `src/prompts/${lang_ext_name}/system_prompt.md`), "utf-8"),
      readFileSync(join(this.extension_path, `src/prompts/${lang_ext_name}/user_prompt.md`), "utf-8"),
    ];
    const context = await this.extract_context(lang_ext_name, pseudocode);
    const base_user_prompt = raw_user_prompt
      .replace("{{pseudocode}}", pseudocode)
      .replace("{{existing_code}}", existing_code)
      .replace("{{context}}", context);
    console.log(`Base User Prompt: ${base_user_prompt}`);
    if (lang_ext_name === "dart") {
      let pubspec: string = "";
      const file_uris = await workspace.findFiles("pubspec.yaml");
      if (file_uris.length > 0) {
        const pubspec_file_uri = file_uris[0];
        pubspec = (await workspace.openTextDocument(pubspec_file_uri)).getText();
      }
      const user_prompt = base_user_prompt.replace("{{pubspec}}", pubspec);
      return [raw_system_prompt, user_prompt];
    } else if (lang_ext_name === "ts") {
      let package_json = "", tsconfig = "";
      const package_json_file_uris = await workspace.findFiles("package.json", "**/node_modules/**", 1);
      if (package_json_file_uris.length > 0) {
        const file_uri = package_json_file_uris[0];
        package_json = (await workspace.openTextDocument(file_uri)).getText();
      }
      const tsconfig_file_uris = await workspace.findFiles("tsconfig.json", "**/node_modules/**", 1);
      if (tsconfig_file_uris.length > 0) {
        const file_uri = tsconfig_file_uris[0];
        tsconfig = (await workspace.openTextDocument(file_uri)).getText();
      }
      const user_prompt = base_user_prompt.replace("{{package_json}}", package_json).replace("{{tsconfig}}", tsconfig);
      return [raw_system_prompt, user_prompt];
    } else if (lang_ext_name === "js") {
      let package_json = "";
      const package_json_file_uris = await workspace.findFiles("package.json", "**/node_modules/**", 1);
      if (package_json_file_uris.length > 0) {
        const file_uri = package_json_file_uris[0];
        package_json = (await workspace.openTextDocument(file_uri)).getText();
      }
      const user_prompt = base_user_prompt.replace("{{package_json}}", package_json);
      return [raw_system_prompt, user_prompt];
    }
    const system_prompt = raw_system_prompt.replaceAll("{{language}}", lang_ext_name);
    const user_prompt = base_user_prompt.replaceAll("{{language}}", lang_ext_name);
    return [system_prompt, user_prompt];
  }
}