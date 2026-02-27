import {Uri} from "vscode";
import DartHandler from "./dart_handler";
import DefaultHandler from "./default_handler";
import JavaHandler from "./java_handler";
import JavaScriptHandler from "./js_handler";
import PythonHandler from "./python_handler";
import TypeScriptHandler from "./ts_handler";
import RustHandler from "./rust_handler";

export interface ILanguageHandler {
  buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string, configFileUri?: Uri, config: string}>;
  addMissingDependencies(configFileUri: Uri, config: string, output: string): void;
}

export function getLanguageHandler(langExtName: string): ILanguageHandler {
  switch (langExtName) {
    case "dart": return new DartHandler();
    case "java": return new JavaHandler();
    case "js": case "jsx": return new JavaScriptHandler();
    case "ts": case "tsx": return new TypeScriptHandler();
    case "py": return new PythonHandler();
    case "rs": return new RustHandler();
    default: return new DefaultHandler();
  }
}