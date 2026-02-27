import {exec} from "child_process";
import {dirname} from "path";
import TOML from "smol-toml";
import {Uri, window, workspace} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

export default class RustHandler implements ILanguageHandler {
  async buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string; configFileUri?: Uri; config: string;}> {
    const cargoUris = await workspace.findFiles("**/Cargo.toml");
    const config = cargoUris.length > 0 ? (await workspace.openTextDocument(cargoUris[0])).getText() : "";
    const userPrompt = baseUserPrompt.replace("{{config}}", config);
    return {userPrompt, configFileUri: cargoUris[0], config};
  }

  addMissingDependencies(configFileUri: Uri, config: string, output: string): void {
    try {
      const dependencies = new Set<string>(["std", "core", "alloc", "crate", "self", "super"]);
      const cargo = TOML.parse(config, {}) as {dependencies?: Record<string, unknown>};
      for (const dep of Object.keys(cargo.dependencies ?? {})) {dependencies.add(dep);}
      const packages = new Set<string>();
      for (const match of output.matchAll(/use\s+([a-zA-Z_][a-zA-Z0-9_]*)/g)) {packages.add(match[1]);}
      const required = Array.from(packages).filter((p) => !dependencies.has(p));
      if (required.length > 0) {
        exec(`cargo add ${required.join(" ")}`, {cwd: dirname(configFileUri.fsPath)}, (err, _, stderr) => {
          if (err) {
            Logger.error("Failed to install dependencies", stderr || err);
            window.showErrorMessage(`Failed to install dependencies: ${err.message}`);
            return;
          }
          window.showInformationMessage(`Shadow Code: Installed ${required.length} Missing Dependencies`);
        });
      }
    } catch (err) {
      Logger.error("Shadow Code Error: Could not parse Cargo.toml", err);
    }
  }
}