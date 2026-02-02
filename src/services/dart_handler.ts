import {exec} from "child_process";
import {load} from "js-yaml";
import {dirname} from "path";
import {Uri, window, workspace} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

export default class DartHandler implements ILanguageHandler {
  async buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string, configFileUri?: Uri, config: string}> {
    const pubspecUris = await workspace.findFiles("**/pubspec.yaml");
    const pubspec = pubspecUris.length > 0 ? (await workspace.openTextDocument(pubspecUris[0])).getText() : "";
    const userPrompt = baseUserPrompt.replace("{{pubspec}}", pubspec);
    return {userPrompt, configFileUri: pubspecUris[0], config: pubspec};
  }

  addMissingDependencies(configFileUri: Uri, config: string, output: string): void {
    try {
      // Get existing dependencies from pubspec.
      const doc = load(config) as {
        name?: string,
        dependencies?: Record<string, unknown>,
        dev_dependencies?: Record<string, unknown>,
      };
      const deps = new Set<string>([
        "flutter",
        "flutter_test",
        ...(doc.name ? [doc.name] : []),
        ...Object.keys(doc.dependencies ?? {}),
        ...Object.keys(doc.dev_dependencies ?? {}),
      ]);

      // Get package imports from output code.
      const packages = new Set<string>([]);
      const matches = output.matchAll(/(?:import|export)\s+['"]package:([a-zA-Z0-9_]+)/g);
      for (const match of matches) {
        packages.add(match[1]);
      }
      console.log("Dart Package Imports: " + Array.from(packages).join(", "));

      // Install missing dependencies.
      const required = Array.from(packages).filter((pkg) => !deps.has(pkg));
      console.log("Pending Required Packages: " + required.join(", "));
      if (required.length > 0) {
        exec(`flutter pub add ${required.join(" ")}`, {cwd: dirname(configFileUri.fsPath)}, (err, _, stderr) => {
          if (err) {
            Logger.error("Failed to install dependencies", err.message);
            window.showErrorMessage(`Failed to install dependenciess: ${stderr}`);
            return;
          }
          window.showInformationMessage(`Shadow Code AI: Installed ${required.length} Missing Dependencies`);
        });
      }
    } catch (err) {
      Logger.error("Shadow Code Error: Could not parse pubspec.yaml", err);
    }
  }
}