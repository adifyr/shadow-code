import {Uri} from "vscode";
import {ILanguageHandler} from "./handler_interface";

export default class DefaultHandler implements ILanguageHandler {
  async buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string; configUri?: Uri; config: string;}> {
    return {userPrompt: baseUserPrompt, config: ""};
  }

  addMissingDependencies(_configFileUri: Uri, _config: string, _output: string): void {
    throw new Error("Method not applicable for default handler.");
  }
}