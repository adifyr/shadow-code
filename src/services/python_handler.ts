import {exec} from "child_process";
import {dirname} from "path";
import TOML from "smol-toml";
import {Uri, window, workspace} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

type PyProject = {
  project?: {dependencies?: string[]},
  tool?: {
    poetry?: {dependencies?: string[]},
    uv?: Record<string, unknown>,
  }
};

export default class PythonHandler implements ILanguageHandler {
  async buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string, configFileUri?: Uri, config: string}> {
    const pyprojectUris = await workspace.findFiles("**/pyproject.toml");
    const config = pyprojectUris.length > 0 ? (await workspace.openTextDocument(pyprojectUris[0])).getText() : "";
    const userPrompt = baseUserPrompt.replace("{{config}}", config);
    return {userPrompt, configFileUri: pyprojectUris[0], config};
  }

  addMissingDependencies(configFileUri: Uri, config: string, output: string): void {
    try {
      // Initialize dependencies with stdlib
      const dependencies = new Set<string>([
        "sys", "os", "re", "json", "math", "random", "datetime", "collections", "itertools", "functools", "operator", "pathlib", "typing", "abc", "copy", "pprint", "ast", "inspect", "traceback", "logging", "warnings", "time", "uuid", "hashlib", "base64", "secrets", "struct", "codecs", "unittest", "doctest", "argparse", "configparser", "io", "tempfile", "pickle", "sqlite3", "csv", "urllib", "http", "threading", "multiprocessing", "subprocess", "zipfile", "tarfile", "shutil", "glob", "email", "html", "xml",
      ]);

      // Parse pyproject.toml file to extract existing dependencies
      const pyproject = TOML.parse(config, {}) as PyProject;
      const projectDeps = pyproject.project?.dependencies;
      if (Array.isArray(projectDeps)) {
        for (const dep of projectDeps) {
          const m = String(dep).match(/^[A-Za-z0-9_\-]+/);
          if (m) {dependencies.add(m[0]);}
        }
      } else if (projectDeps && typeof projectDeps === "object") {
        for (const k of Object.keys(projectDeps)) {dependencies.add(k);}
      }
      const poetryDeps = pyproject.tool?.poetry?.dependencies;
      if (poetryDeps && typeof poetryDeps === "object") {
        for (const k of Object.keys(poetryDeps)) {dependencies.add(k);}
      }

      // Extract imports from python source code file
      const packages = new Set<string>();
      const normalizedOutput = output.replace(/\\\n/g, "");
      for (const match of normalizedOutput.matchAll(/import\s+([A-Za-z0-9_\.]+)/gim)) {
        const pkg = match[1].split(".")[0];
        if (!pkg.startsWith(".")) {packages.add(pkg);}
      }
      for (const match of normalizedOutput.matchAll(/from\s+([A-Za-z0-9_\.]+)/gim)) {
        const pkg = match[1].split(".")[0];
        if (!pkg.startsWith(".")) {packages.add(pkg);}
      }

      // Check for any missing dependencies and install them
      const required = Array.from(packages).filter((pkg) => !dependencies.has(pkg));
      if (required.length > 0) {
        const cmd = pyproject.tool?.poetry ? "poetry add" : (pyproject.tool?.uv ? "uv add" : undefined);
        if (cmd) {
          exec(`${cmd} ${required.join(" ")}`, {cwd: dirname(configFileUri.fsPath)}, (err, _, stderr) => {
            if (err) {
              Logger.error("Failed to install dependencies", stderr);
              window.showErrorMessage(`Failed to install dependencies: ${err.message}`);
              return;
            }
            window.showInformationMessage(`Shadow Code: Installed ${required.length} Missing Dependencies`);
          });
        }
      }
    } catch (err) {
      Logger.error("Shadow Code Error: Could not parse pyproject.toml", err);
    }
  }
}