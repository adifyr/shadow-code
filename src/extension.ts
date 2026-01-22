import {extname} from 'path';
import * as vscode from 'vscode';
import {GeminiService} from './gemini_service';
import {ShadowFileManager} from './shadow_file_manager';
import {start_realtime_generation, stop_realtime_generation} from './realtime_generation';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "Shadow Code AI" is now active.');
  const gemini_service = GeminiService.initialize(context.extensionPath);
  if (!gemini_service) {return;}

  // Register the command that initiates Shadow Mode for code file.
  context.subscriptions.push(
    vscode.commands.registerCommand("shadowCodeAI.openInShadowMode", async (uri?: vscode.Uri) => {
      const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      await ShadowFileManager.open_shadow_file(fileUri);
    })
  );

  // Register the command that generates code from pseudocode.
  // context.subscriptions.push(vscode.commands.registerCommand("shadowCodeAI.generateCode", async () => {
  //   await generate_code(gemini_service);
  // }));

  // Register the command that copies over the existing code.
  context.subscriptions.push(vscode.commands.registerCommand("shadowCodeAI.copyCode", copy_code));

  // Start realtime generation for already-open shadow files
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      start_generation_for_document(doc, gemini_service);
    }
  });

  // Watch for shadow files being opened
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      console.log("Shadow file opened. Starting listener.");
      start_generation_for_document(doc, gemini_service);
    }
  }));

  // Stop generation when shadow file closes
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      console.log("Shadow file closed. Stopping listener.");
      stop_realtime_generation(doc.uri);
    }
  }));
}

function start_generation_for_document(doc: vscode.TextDocument, gemini_service: GeminiService) {
  const shadowUri = doc.uri;
  const originalPath = shadowUri.fsPath
    .replace('/.shadow/', '/')
    .replace('.shadow', '');
  const originalUri = vscode.Uri.file(originalPath);
  const lang_ext_name = extname(originalPath).slice(1);
  start_realtime_generation(shadowUri, originalUri, gemini_service, lang_ext_name);
}

async function copy_code() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document.uri.fsPath.endsWith(".shadow")) {
    vscode.window.showWarningMessage("Please open a .shadow file first.");
    return;
  }

  const shadowFileUri = editor.document.uri;
  const originalFilePath = shadowFileUri.fsPath.replace("/.shadow/", "/").replace(".shadow", "");
  const originalFileUri = vscode.Uri.file(originalFilePath);
  const originalCode = (await vscode.workspace.openTextDocument(originalFileUri)).getText();
  const edit = new vscode.WorkspaceEdit();
  edit.replace(shadowFileUri, new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), originalCode);
  await vscode.workspace.applyEdit(edit);
}

// async function generate_code(gemini_service: GeminiService) {
//   const editor = vscode.window.activeTextEditor;
//   if (!editor || !editor.document.uri.fsPath.endsWith(".shadow")) {
//     vscode.window.showWarningMessage("Please open a .shadow file first.");
//     return;
//   }

//   const shadow_file_uri = editor.document.uri;
//   const original_file_path = shadow_file_uri.fsPath.replace("/.shadow/", "/").replace(".shadow", "");
//   const original_file_uri = vscode.Uri.file(original_file_path);
//   const existing_code = (await vscode.workspace.openTextDocument(original_file_uri)).getText();
//   const pseudocode = editor.document.getText();
//   const lang_ext_name = extname(original_file_path).slice(1);

//   await vscode.window.withProgress({
//     location: vscode.ProgressLocation.Notification,
//     title: "Generating Code...",
//     cancellable: false,
//   }, async () => {
//     const generated_code = await gemini_service.process_pseudocode(lang_ext_name, pseudocode, existing_code);
//     if (generated_code) {
//       const edit = new vscode.WorkspaceEdit();
//       edit.replace(
//         original_file_uri,
//         new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
//         generated_code
//       );
//       await vscode.workspace.applyEdit(edit);
//     }
//   });
// }

export function deactivate() {
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      stop_realtime_generation(doc.uri);
    }
  });
}