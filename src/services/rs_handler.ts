import {execFile} from "child_process";
import {existsSync} from "fs";
import {parse} from "smol-toml";
import {dirname, join} from "path";
import {Uri, window, workspace} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

const NON_EXTERNAL_ROOTS = new Set([
  "std", "core", "alloc", "proc_macro", "test",
  "crate", "self", "super",
]);

export default class RustHandler implements ILanguageHandler {
  async buildUserPrompt(baseUserPrompt: string, originalFileUri?: Uri): Promise<{userPrompt: string; configFileUri?: Uri; config: string;}> {
    let cargoTomlUri: Uri | undefined;

    // Walk up from the active file to find the nearest Cargo.toml.
    if (originalFileUri) {
      let dir = dirname(originalFileUri.fsPath);
      const workspaceRoot = workspace.getWorkspaceFolder(originalFileUri)?.uri.fsPath;
      while (dir) {
        const candidate = join(dir, "Cargo.toml");
        if (existsSync(candidate)) {
          cargoTomlUri = Uri.file(candidate);
          break;
        }
        const parent = dirname(dir);
        if (parent === dir) {break;}
        if (workspaceRoot && !parent.startsWith(workspaceRoot)) {break;}
        dir = parent;
      }
    }

    // Fall back to workspace-wide search if walk-up found nothing.
    if (!cargoTomlUri) {
      const cargoTomlUris = await workspace.findFiles("**/Cargo.toml", "{**/target/**,**/node_modules/**,**/.git/**,**/vendor/**}");
      cargoTomlUri = cargoTomlUris.length > 0 ? cargoTomlUris[0] : undefined;
    }

    if (!cargoTomlUri) {
      return {userPrompt: baseUserPrompt.replace("{{cargo_toml}}", ""), config: ""};
    }

    const cargoToml = (await workspace.openTextDocument(cargoTomlUri)).getText();
    const userPrompt = baseUserPrompt.replace("{{cargo_toml}}", cargoToml);
    return {userPrompt, configFileUri: cargoTomlUri, config: cargoToml};
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
      const braceUseRegex = /use\s*\{([^}]+)\}\s*;/g;
      const externRegex = /extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      let match;
      while ((match = useRegex.exec(output)) !== null) {
        crates.add(match[1]);
      }
      while ((match = braceUseRegex.exec(output)) !== null) {
        for (const ident of match[1].split(",")) {
          const trimmed = ident.trim();
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
            crates.add(trimmed);
          }
        }
      }
      while ((match = externRegex.exec(output)) !== null) {
        crates.add(match[1]);
      }

      // Filter to missing external crates and convert underscores to hyphens for cargo add.
      const required = Array.from(crates)
        .filter((c) => !deps.has(c))
        .map((c) => c.replace(/_/g, "-"));

      if (required.length > 0) {
        execFile("cargo", ["add", ...required], {cwd: dirname(configFileUri.fsPath), timeout: 30_000}, (err, _, stderr) => {
          if (err) {
            Logger.error(`Failed to install dependencies: ${stderr}`, err);
            window.showWarningMessage("Shadow Code: Failed to install some Rust dependencies. Check the output log for details.");
            return;
          }
          window.showInformationMessage(`Shadow Code: Installed ${required.length} Missing Dependencies`);
        });
      }
    } catch (err) {
      Logger.error("Shadow Code Error: Could not parse Cargo.toml", err);
      window.showWarningMessage("Shadow Code: Could not parse Cargo.toml — dependency auto-install skipped.");
    }
  }
}
