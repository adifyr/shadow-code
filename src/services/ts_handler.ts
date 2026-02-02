import {exec} from "child_process";
import {builtinModules} from "module";
import {dirname} from "path";
import {Uri, window, workspace} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

export default class TypeScriptHandler implements ILanguageHandler {
  async buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string; configFileUri?: Uri; config: string;}> {
    const pkgJsonUris = await workspace.findFiles("**/package.json", "**/node_modules/**");
    const packageJson = pkgJsonUris.length > 0 ? (await workspace.openTextDocument(pkgJsonUris[0])).getText() : "";
    const userPrompt = baseUserPrompt.replace("{{package_json}}", packageJson);
    return {userPrompt, configFileUri: pkgJsonUris[0], config: packageJson};
  }

  addMissingDependencies(configFileUri: Uri, config: string, output: string): void {
    const pkg = JSON.parse(config);
    const projectName = pkg.name ?? "";
    const deps = new Set<string>([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...builtinModules,
      projectName,
    ]);
    const importsRegex = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(['"])(@?[a-zA-Z0-9-._]+)(?:\/.*?)?['"]\)?/g;
    const packages = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = importsRegex.exec(output)) !== null) {
      if (!match[1].startsWith(".")) {
        packages.add(match[1]);
      }
    }
    const required = Array.from(packages).filter((pkg) => !deps.has(pkg));
    if (required.length > 0) {
      exec(`npm install ${required.join(' ')}`, {cwd: dirname(configFileUri.fsPath)}, (err, stdout, stderr) => {
        if (err) {
          Logger.error("Failed to install dependencies", err.message);
          window.showErrorMessage(`Failed to install deps: ${stderr}`);
          return;
        }
        Logger.info(`Dependencies Installed. Stdout:\n${stdout}`);
        window.setStatusBarMessage(`$(check) Installed ${required.entries.length} Dependencies`, 3000);
      });
    }
  }
}