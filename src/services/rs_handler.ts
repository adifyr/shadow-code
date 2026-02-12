import {exec} from "child_process";
import {parse} from "smol-toml";
import {dirname} from "path";
import {Uri, window, workspace} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

const NON_EXTERNAL_ROOTS = new Set([
  "std", "core", "alloc", "proc_macro", "test",
  "crate", "self", "super",
]);

export default class RustHandler implements ILanguageHandler {
  async buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string; configFileUri?: Uri; config: string;}> {
    const cargoTomlUris = await workspace.findFiles("**/Cargo.toml", "**/target/**");
    const cargoToml = cargoTomlUris.length > 0 ? (await workspace.openTextDocument(cargoTomlUris[0])).getText() : "";
    const userPrompt = baseUserPrompt.replace("{{cargo_toml}}", cargoToml);
    return {userPrompt, configFileUri: cargoTomlUris[0], config: cargoToml};
  }

  addMissingDependencies(configFileUri: Uri, config: string, output: string): void {
    try {
      const doc = parse(config) as {
        package?: {name?: string};
        dependencies?: Record<string, unknown>;
        "dev-dependencies"?: Record<string, unknown>;
        "build-dependencies"?: Record<string, unknown>;
        workspace?: {dependencies?: Record<string, unknown>};
      };

      // Collect existing dependency names, normalized to underscores for comparison with use statements.
      const deps = new Set<string>([
        ...NON_EXTERNAL_ROOTS,
        ...(doc.package?.name ? [doc.package.name.replace(/-/g, "_")] : []),
        ...Object.keys(doc.dependencies ?? {}).map((k) => k.replace(/-/g, "_")),
        ...Object.keys(doc["dev-dependencies"] ?? {}).map((k) => k.replace(/-/g, "_")),
        ...Object.keys(doc["build-dependencies"] ?? {}).map((k) => k.replace(/-/g, "_")),
        ...Object.keys(doc.workspace?.dependencies ?? {}).map((k) => k.replace(/-/g, "_")),
      ]);

      // Extract crate roots from use statements and extern crate declarations.
      const crates = new Set<string>();
      const useRegex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
      const externRegex = /extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      let match;
      while ((match = useRegex.exec(output)) !== null) {
        crates.add(match[1]);
      }
      while ((match = externRegex.exec(output)) !== null) {
        crates.add(match[1]);
      }

      // Filter to missing external crates and convert underscores to hyphens for cargo add.
      const required = Array.from(crates)
        .filter((c) => !deps.has(c))
        .map((c) => c.replace(/_/g, "-"));

      if (required.length > 0) {
        exec(`cargo add ${required.join(" ")}`, {cwd: dirname(configFileUri.fsPath)}, (err, _, stderr) => {
          if (err) {
            Logger.error("Failed to install dependencies", err.message);
            window.showErrorMessage(`Failed to install dependencies: ${stderr}`);
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
