import {GoogleGenAI} from "@google/genai";
import {readFileSync} from "fs";
import {join} from "path";
import {window, workspace} from "vscode";

export async function processPseudocode(
  language: string,
  pseudocode: string,
  code: string,
  extensionPath: string,
): Promise<string | undefined> {
  const CONFIG = workspace.getConfiguration("shadowCodeAI");
  const apiKey = CONFIG.get<string>("geminiApiKey");
  if (!apiKey) {
    window.showWarningMessage("Gemini API Key is not configured.");
    return;
  }

  const genAI = new GoogleGenAI({apiKey});
  const response = await genAI.models.generateContent({
    model: CONFIG.get<string>("modelName") ?? "gemini-2.5-flash-lite",
    contents: buildUserPrompt(language, pseudocode, code, extensionPath),
    config: {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      systemInstruction: readFileSync(join(extensionPath, "src/prompts/system_prompt.txt"), "utf-8"),
    }
  });

  if (!response.text) {
    window.showErrorMessage("Error: Gemini API failed to generate code for this file");
    return;
  }
  return response.text;
}

function buildUserPrompt(language: string, pseudocode: string, code: string, extensionPath: string): string {
  let instructions: string;
  try {
    instructions = readFileSync(join(extensionPath, `src/prompts/${language}_instructions.txt`), "utf-8");
  } catch {
    console.error(`Instructions file for language "${language}" not found. Using generic instructions instead...`);
    instructions = readFileSync(join(extensionPath, `src/prompts/generic_instructions.txt`), "utf-8");
  }
  const userPrompt = readFileSync(join(extensionPath, "src/prompts/user_prompt.txt"), "utf-8")
    .replace("{{language}}", language)
    .replace("{{pseudocode}}", pseudocode)
    .replace("{{code}}", code)
    .replace("{{instructions}}", instructions);
  console.log("Complete User Prompt:\n\n", userPrompt);
  return userPrompt;
}