import {Uri} from "vscode";
import {ILanguageHandler} from "./handler_interface";


export default class DefaultHandler implements ILanguageHandler {
  readonly language: string;
  readonly configOptions: string[];

  constructor(private readonly langExtName: string) {
    this.language = {
      ".js": "JavaScript",
      ".jsx": "JavaScript",
      ".mjs": "JavaScript",
      ".cjs": "JavaScript",
      ".ts": "TypeScript",
      ".tsx": "TypeScript",
      ".py": "Python",
      ".java": "Java",
      ".kt": "Kotlin",
      ".kts": "Kotlin",
      ".swift": "Swift",
      ".go": "Go",
      ".rs": "Rust",
      ".cpp": "C++",
      ".cc": "C++",
      ".cxx": "C++",
      ".c": "C",
      ".h": "C",
      ".hpp": "C++",
      ".cs": "C#",
      ".php": "PHP",
      ".rb": "Ruby",
      ".pl": "Perl",
      ".scala": "Scala",
      ".scala.html": "Scala",
      ".dart": "Dart",
      ".lua": "Lua",
      ".hs": "Haskell",
      ".erl": "Erlang",
      ".ex": "Elixir",
      ".exs": "Elixir",
      ".r": "R",
      ".sql": "SQL",
      ".ps1": "PowerShell",
      ".sh": "ShellScript",
      ".bash": "ShellScript",
      ".zsh": "ShellScript",
      ".html": "HTML",
      ".htm": "HTML",
      ".css": "CSS",
      ".scss": "SCSS",
      ".less": "Less",
      ".json": "Json",
      ".yaml": "Yaml",
      ".yml": "Yaml",
      ".xml": "XML",
      ".md": "Markdown",
      ".tex": "LaTex",
      ".swiftpm": "Swift",
      ".m": "Objective-C",
      ".mm": "Objective-CPP",
      ".gradle": "Groovy",
      ".groovy": "Groovy",
      ".sbt": "Scala",
      ".ini": "INI",
      ".toml": "Toml",
      ".vim": "Vim",
      ".zig": "Zig",
    }[langExtName] ?? `"${langExtName}"`;
    this.configOptions = [];
  }

  async buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string; configUri?: Uri; config: string;}> {
    return {userPrompt: baseUserPrompt, config: ""};
  }

  addMissingDependencies(_configFileUri: Uri, _config: string, _output: string): void {
    throw new Error("Method not applicable for default handler.");
  }
}