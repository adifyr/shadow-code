import {extname} from 'path';
import * as vscode from 'vscode';
import {start_realtime_generation, stop_realtime_generation} from './realtime_generation';
import {ShadowCodeService} from './shadow_code_service';
import {ShadowFileManager} from './shadow_file_manager';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "Shadow Code AI" is now active.');
  const shadow_code_service = ShadowCodeService.initialize(context.extensionPath);
  if (!shadow_code_service) {return;}

  // Register the command that initiates Shadow Mode for code file.
  context.subscriptions.push(
    vscode.commands.registerCommand("shadowCodeAI.openInShadowMode", async (uri?: vscode.Uri) => {
      const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      await ShadowFileManager.open_shadow_file(fileUri);
    })
  );

  // Register the command that copies over the existing code.
  context.subscriptions.push(vscode.commands.registerCommand("shadowCodeAI.copyCode", copy_code));

  // Start realtime generation for already-open shadow files
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      start_generation_for_document(doc, shadow_code_service);
    }
  });

  // Watch for shadow files being opened
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      console.log("Shadow file opened. Starting listener.");
      start_generation_for_document(doc, shadow_code_service);
    }
  }));

  // Stop generation when shadow file closes
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      console.log("Shadow file closed. Stopping listener.");
      stop_realtime_generation(doc.uri);
    }
  }));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({pattern: '**/*.shadow'}, {
    async provideCompletionItems(document, position) {
      const line_text = document.lineAt(position.line).text;
      const text_before_cursor = line_text.substring(0, position.character);

      if (!text_before_cursor.includes('use(') || !text_before_cursor.match(/use\([^)]*$/)) {
        return undefined;
      }

      const before_quote = text_before_cursor.substring(0, text_before_cursor.lastIndexOf('"'));
      const quote_count = (before_quote.match(/"/g) || []).length;

      if (quote_count % 2 === 0) {
        return undefined;
      }

      const workspace_folder = vscode.workspace.workspaceFolders?.[0];
      if (!workspace_folder) {
        return undefined;
      }

      // Determine search pattern based on language
      const original_file_path = document.uri.fsPath.replace("/.shadow/", "/").replace(".shadow", "");
      const ext_name = extname(original_file_path).slice(1);
      const files = await vscode.workspace.findFiles({
        dart: "lib/**/*",
        js: "src/**/*",
        ts: "src/**/*",
      }[ext_name] ?? "**/*");
      const completion_items = files.map((file_uri) => {
        const relative_path = vscode.workspace.asRelativePath(file_uri);
        const item = new vscode.CompletionItem(relative_path, vscode.CompletionItemKind.File);
        item.insertText = relative_path;
        return item;
      });
      return completion_items;
    }
  }, '"'));
}

function start_generation_for_document(doc: vscode.TextDocument, shadow_code_service: ShadowCodeService) {
  const shadowUri = doc.uri;
  const originalPath = shadowUri.fsPath.replace('/.shadow/', '/').replace('.shadow', '');
  const originalUri = vscode.Uri.file(originalPath);
  const lang_ext_name = extname(originalPath).slice(1);
  start_realtime_generation(shadowUri, originalUri, shadow_code_service, lang_ext_name);
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

export function deactivate() {
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.uri.fsPath.endsWith('.shadow')) {
      stop_realtime_generation(doc.uri);
    }
  });
}