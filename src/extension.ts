// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {extname} from 'path';
import * as vscode from 'vscode';
import {processPseudocode} from './gemini_service';
import {createShadowFile} from './shadow_file_manager';
import {createPatch} from 'diff';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "Shadow Code AI" is now active.');

  // Register the command that initiates Shadow Mode for code file.
  vscode.commands.registerCommand("shadowCodeAI.openInShadowMode", async (uri?: vscode.Uri) => {
    const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showErrorMessage("No file selected.");
      return;
    }
    await createShadowFile(targetUri);
  });

  // Register the command that generates code from pseudocode.
  vscode.commands.registerCommand("shadowCodeAI.generateCode", async () => {
    await generateCode(context.extensionPath);
  });

  // // Register the Shadow File listener.
  // context.subscriptions.push(
  //   vscode.workspace.onDidChangeTextDocument(async (event) => {
  //     // Ensure the uri belongs to a Shadow File.
  //     const shadowFileUri = event.document.uri;
  //     if (!shadowFileUri.fsPath.endsWith(".shadow")) {
  //       return;
  //     }

  //     // Get the uri of the corresponding original file.
  //     const originalFilePath = shadowFileUri.fsPath.replace("/.shadow/", "/").replace(".shadow", "");
  //     const originalFileUri = vscode.Uri.file(originalFilePath);

  //     // Apply changes to the original file.
  //     const edit = new vscode.WorkspaceEdit();
  //     event.contentChanges.forEach((change) => edit.replace(originalFileUri, change.range, change.text));
  //     await vscode.workspace.applyEdit(edit);
  //   }),
  // );
}

async function generateCode(extensionPath: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document.uri.fsPath.endsWith(".shadow")) {
    vscode.window.showWarningMessage("Please open a .shadow file first.");
    return;
  }

  const shadowFileUri = editor.document.uri;
  const originalFilePath = shadowFileUri.fsPath.replace("/.shadow/", "/").replace(".shadow", "");
  const originalFileUri = vscode.Uri.file(originalFilePath);
  const originalCode = (await vscode.workspace.openTextDocument(originalFileUri)).getText();
  const pseudocode = editor.document.getText();
  const language = extname(originalFilePath).slice(1);

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Generating Code...",
    cancellable: false,
  }, async () => {
    const generatedCode = await processPseudocode(language, pseudocode, originalCode, extensionPath);
    if (generatedCode) {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(originalFileUri, new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), generatedCode);
      await vscode.workspace.applyEdit(edit);
      vscode.window.showInformationMessage("Code Generated Successfully ✅");
    }
  });
}

// this method is called when your extension is deactivated
export function deactivate() { }