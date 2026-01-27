import {GoogleGenAI} from "@google/genai";
import {readFileSync} from "fs";
import {join} from "path";
import {window, workspace, WorkspaceConfiguration} from "vscode";
import {LANGUAGES} from "./languages";

export class GeminiService {
  private gen_ai: GoogleGenAI;
  private model_name: string;

  private constructor(private extension_path: string, config: WorkspaceConfiguration, api_key: string) {
    this.model_name = config.get<string>("modelName") ?? "gemini-2.5-flash-lite";
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
    const language = LANGUAGES.get(lang_ext_name);
    let language_instructions: string;
    try {
      language_instructions = this.read_prompt_file(lang_ext_name);
    } catch {
      console.warn(`WARNING: Instructions file for language "${language}" not found. Using generic instructions set.`);
      language_instructions = this.read_prompt_file();
    }
    const system_prompt = this.base_system_prompt.replace("{{language_instructions}}", language_instructions);
    const user_prompt = this.base_user_prompt
      .replace("{{language}}", language ?? `.${lang_ext_name}`)
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
    const output = response.text.replaceAll("```", "").trim();
    return output;
  }

  private get_prompts(
    lang_ext_name: string = "default",
    pseudocode: string,
    existing_code: string
  ): [string, string] {
    const [raw_system_prompt, raw_user_prompt] = [
      readFileSync(join(this.extension_path, `src/prompts/${lang_ext_name}/system_prompt.md`), "utf-8"),
      readFileSync(join(this.extension_path, `src/prompts/${lang_ext_name}/user_prompt.md`), "utf-8"),
    ];
    const system_prompt = raw_system_prompt.replaceAll("{{language}}", lang_ext_name);
    const user_prompt = raw_user_prompt.replaceAll("{{language}}", lang_ext_name)
      .replace("{{pseudocode}}", pseudocode)
      .replace("{{existing_code}}", existing_code);
    return [system_prompt, user_prompt];
  }
}
