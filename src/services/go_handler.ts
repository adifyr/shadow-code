import {exec} from "child_process";
import {dirname} from "path";
import {Uri, window} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

export default class GoHandler implements ILanguageHandler {
  readonly language: string = "Go";
  readonly configOptions: string[] = ["go.mod"];

  addMissingDependencies(configFileUri: Uri, _config: string, output: string): void {
    try {
      const cwd = dirname(configFileUri.fsPath);
      exec(`go list -m -f '{{if not .Indirect}}{{.Path}}{{end}}' all`, {cwd}, (err, stdout, stderr) => {
        if (err) {
          Logger.error("Could not list Go modules", err.message);
          window.showErrorMessage(`Shadow Code: Failed to list Go modules: ${stderr}`);
          return;
        }
        const dependencies = new Set<string>(stdout.split(/\r?\n/).map((dep) => dep.trim()));
        const imports = new Set<string>();
        for (const match of output.matchAll(/import\s+["']([^"']+)["']/g)) {
          if (/^[^/]*\.[^/]+/.test(match[1])) {
            imports.add(match[1]);
          }
        }
        for (const block of output.matchAll(/import\s*\(([\s\S]*?)\)/g)) {
          for (const match of block[1].matchAll(/["']([^"']+)["']/g)) {
            if (/^[^/]*\.[^/]+/.test(match[1])) {
              imports.add(match[1]);
            }
          }
        }
        const required = Array.from(imports).filter((dep) => !dependencies.has(dep));
        if (required.length > 0) {
          exec(`go get ${required.join(" ")}`, {cwd}, (err2, _stdout2, _stderr2) => {
            if (err2) {
              Logger.error("Failed to install Go dependencies", err2.message);
              window.showErrorMessage(`Shadow Code: Failed to install dependencies: ${_stderr2 ?? ""}`);
              return;
            }
            window.showInformationMessage(`Shadow Code: Installed ${required.length} Dependencies`);
          });
        }
      });
    } catch (err) {
      Logger.error("Shadow Code Error: Could not process Go dependencies", (err as Error).message);
    }
  }
}