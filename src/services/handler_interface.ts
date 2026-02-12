import {Uri} from "vscode";
import DartHandler from "./dart_handler";
import DefaultHandler from "./default_handler";
import JavaScriptHandler from "./js_handler";
import RustHandler from "./rs_handler";
import TypeScriptHandler from "./ts_handler";

export interface ILanguageHandler {
  buildUserPrompt(baseUserPrompt: string, originalFileUri?: Uri): Promise<{userPrompt: string, configFileUri?: Uri, config: string}>;
  addMissingDependencies(configFileUri: Uri, config: string, output: string): void;
}

export function getLanguageHandler(langExtName: string): ILanguageHandler {
  switch (langExtName) {
    case "dart": return new DartHandler();
    case "js": case "jsx": return new JavaScriptHandler();
    case "ts": case "tsx": return new TypeScriptHandler();
    case "rs": return new RustHandler();
    default: return new DefaultHandler();
  }
}