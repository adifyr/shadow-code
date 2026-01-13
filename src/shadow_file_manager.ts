import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";


/**
 * Creates a shadow file associated with the given file URI.
 * 
 * Shadow files are created in a `.shadow` directory that mirrors the workspace folder structure.
 * If the shadow file already exists, a notification is shown. Otherwise, a new empty shadow file
 * is created and opened in the editor.
 * 
 * @param fileUri - The URI of the file for which to create a shadow file.
 * @returns A promise that resolves when the shadow file has been created and opened.
 * 
 * @example
 * ```typescript
 * const fileUri = vscode.window.activeTextEditor?.document.uri;
 * if (fileUri) {
 *   await createShadowFile(fileUri);
 * }
 * ```
 * 
 * @remarks
 * - The function will prevent the user from enabling shadow mode if the target is itself a shadow file.
 * - The function will display an error message if the file is not inside a workspace folder.
 * - The shadow file is created with a `.shadow` extension appended to the original filename.
 * - The shadow file is opened in the first view column (ViewColumn.One).
 * - An information message is shown indicating whether the file was newly created or already existed.
 */
export async function createShadowFile(fileUri: vscode.Uri) {
  // If the target file is itself a shadow file, show an error message.
  if (fileUri.fsPath.endsWith(".shadow")) {
    vscode.window.showWarningMessage("Cannot enable Shadow Mode for a shadow file.");
    return;
  }

  // Get the workspace folder.
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("Cannot enable Shadow Mode. File is not inside a workspace folder.");
    return;
  }

  // Replicate the relative path of the file from workspace root into the new shadow folder.
  const relativePath = vscode.workspace.asRelativePath(fileUri);
  const shadowDir = path.join(workspaceFolder.uri.fsPath, '.shadow', path.dirname(relativePath));
  const shadowFilePath = path.join(shadowDir, path.basename(fileUri.fsPath) + '.shadow');

  // Create the shadow directory.
  fs.mkdirSync(shadowDir, {recursive: true});

  // Check if the shadow file exists.
  try {
    fs.accessSync(shadowFilePath);
    vscode.window.showInformationMessage(`Shadow File already exists: ${shadowFilePath}`);
  } catch {
    // Shadow file does not exist, create the shadow file.
    fs.writeFileSync(shadowFilePath, '');
    vscode.window.showInformationMessage(`New Shadow File created: ${shadowFilePath}`);
  }

  // Open the newly created shadow file in split view.
  const shadowFileUri = vscode.Uri.file(shadowFilePath);
  await vscode.window.showTextDocument(shadowFileUri, {viewColumn: vscode.ViewColumn.Beside});
}