import {Uri} from "vscode";
import DartHandler from "./dart_handler";
import DefaultHandler from "./default_handler";
import JavaHandler from "./java_handler";
import JavaScriptHandler from "./js_handler";
import PythonHandler from "./python_handler";
import TypeScriptHandler from "./ts_handler";

export interface ILanguageHandler {
  buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string, configFileUri?: Uri, config: string}>;
  addMissingDependencies(configFileUri: Uri, config: string, output: string): void;
}

export function getLanguageHandler(langExtName: string): ILanguageHandler {
  switch (langExtName) {
    case "dart": return new DartHandler();
    case "java": return new JavaHandler();
    case "js": case "jsx": return new JavaScriptHandler();
    case "python": return new PythonHandler();
    case "ts": case "tsx": return new TypeScriptHandler();
    default: return new DefaultHandler();
  }
}