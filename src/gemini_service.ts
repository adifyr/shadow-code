import {GoogleGenAI} from "@google/genai";
import {readFileSync} from "fs";
import {join} from "path";
import {window, workspace, WorkspaceConfiguration} from "vscode";
import {languages} from "./languages";

export class GeminiService {
  private gen_ai: GoogleGenAI;
  private model_name: string;
  private base_system_prompt: string;
  private base_user_prompt: string;

  private constructor(private extension_path: string, config: WorkspaceConfiguration, api_key: string) {
    this.model_name = config.get<string>("modelName") ?? "gemini-2.5-flash-lite";
    this.base_system_prompt = this.read_prompt_file("system_prompt");
    this.base_user_prompt = this.read_prompt_file("user_prompt");
    this.gen_ai = new GoogleGenAI({apiKey: api_key});
  }

  static initialize(extension_path: string): GeminiService | undefined {
    const config = workspace.getConfiguration("shadowCodeAI");
    const api_key = config.get<string>("geminiApiKey");
    if ((api_key?.length ?? 0) === 0) {
      window.showWarningMessage("Please configure your Gemini API Key first.");
      return;
    }
    return new GeminiService(extension_path, config, api_key!);
  }

  async process_pseudocode(
    lang_ext_name: string,
    pseudocode: string,
    existing_code: string
  ): Promise<string | undefined> {
    const language = languages[lang_ext_name];
    let language_instructions: string;
    try {
      language_instructions = this.read_prompt_file(lang_ext_name);
    } catch {
      console.warn(`WARNING: Instructions file for language "${language}" not found. Using generic instructions set.`);
      language_instructions = this.read_prompt_file(language);
    }
    const system_prompt = this.base_system_prompt.replace("{{language_instructions}}", language_instructions);
    const user_prompt = this.base_user_prompt
      .replace("{{language}}", language)
      .replace("{{pseudocode}}", pseudocode)
      .replace("{{existing_code}}", existing_code);
    const response = await this.gen_ai.models.generateContent({
      model: this.model_name,
      contents: user_prompt,
      config: {
        thinkingConfig: {thinkingBudget: 0},
        systemInstruction: system_prompt,
      },
    });
    if (!response.text) {
      window.showErrorMessage("Error: Gemin API failed to generate code for this shadow file.");
      return;
    }
    const output = response.text.replaceAll("```", "");
    return output;
  }

  private read_prompt_file(filename: string = "generic"): string {
    const path = filename.includes("prompt") ? "" : "languages/";
    return readFileSync(join(this.extension_path, "src/prompts/", `${path}${filename}.md`), "utf-8");
  }
}
