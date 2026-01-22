import * as fs from "fs";
import * as path from "path";
import {window, workspace, languages, ViewColumn, Uri} from "vscode";

export class ShadowFileManager {
  static async open_shadow_file(file_uri: Uri | undefined) {
    if (!file_uri) {
      window.showErrorMessage("No file selected.");
      return;
    }
    if (file_uri.fsPath.endsWith(".shadow")) {
      window.showErrorMessage("Cannot enable Shadow Mode for a .shadow file.");
      return;
    }
    const workspace_folder = workspace.getWorkspaceFolder(file_uri);
    if (!workspace_folder) {
      window.showErrorMessage("Cannot enable Shadow Mode. File is not inside a workspace folder.");
      return;
    }

    const relative_path = workspace.asRelativePath(file_uri);
    const shadow_dir = path.join(workspace_folder.uri.fsPath, ".shadow", path.dirname(relative_path));
    const shadow_file_path = path.join(shadow_dir, path.basename(file_uri.fsPath) + ".shadow");
    const shadow_file_name = path.basename(shadow_file_path);
    fs.mkdirSync(shadow_dir, {recursive: true});

    try {
      fs.accessSync(shadow_file_path);
      window.showInformationMessage(`Shadow File "${shadow_file_name}" already exists.`);
    } catch {
      fs.writeFileSync(shadow_file_path, '');
      window.showInformationMessage(`Shadow File "${shadow_file_name}" successfully created`);
    }

    const doc = await workspace.openTextDocument(shadow_file_path);
    await languages.setTextDocumentLanguage(doc, path.extname(shadow_file_path.replaceAll(".shadow", "")).slice(1));
    window.showTextDocument(doc, {viewColumn: ViewColumn.Beside});
  }
}