import {diffLines} from "diff";
import {existsSync, mkdirSync, writeFileSync} from "fs";
import {basename, dirname, extname, join, sep} from "path";
import {commands, CompletionItem, CompletionItemKind, Extension, ExtensionContext, languages, MarkdownString, Position, ProgressLocation, Range, SnippetString, TextDocument, Uri, ViewColumn, window, workspace, WorkspaceEdit} from "vscode";
import {ShadowCodeService} from "./service";

export function activate(context: ExtensionContext) {
  // Initialize Shadow Code Service.
  console.log("Extension 'Shadow Code AI' activated.");
  const service = ShadowCodeService.initialize(context.extensionPath);
  if (!service) {return;}

  cleanupGhostCheckpoints(context);

  // Register Commands.
  context.subscriptions.push(commands.registerCommand("shadowCodeAI.openInShadowMode", async (uri: Uri) => {
    await openShadowFile(uri, context);
  }));
  context.subscriptions.push(commands.registerCommand("shadowCodeAI.copyCode", async (uri: Uri) => {
    await copyCode(uri, context);
  }));
  context.subscriptions.push(commands.registerCommand("shadowCodeAI.generateCode", () => {
    window.withProgress({location: ProgressLocation.Window, title: "Shadow Code AI"}, async (progress) => {
      progress.report({message: "Converting Shadow Code"});
      await convertShadowCode(service, context, window.activeTextEditor?.document);
    });
  }));

  // Register Completion Providers.
  context.subscriptions.push(languages.registerCompletionItemProvider({language: "shadow", pattern: "**/*.shadow"}, {
    async provideCompletionItems(document: TextDocument, position: Position) {
      const lineText = document.lineAt(position.line).text;
      const textBeforeCursor = lineText.substring(0, position.character);
      const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
      if (!/use\([^)]*$/.test(textBeforeCursor) || quoteCount % 2 === 0) {
        return;
      }
      const extName = extname(document.uri.fsPath.replace(/\.shadow$/, "")).slice(1);
      const files = await workspace.findFiles({dart: "lib/**/*", js: "src/**/*", ts: "src/**/*"}[extName] ?? "**/*");
      const completionItems = files.map((file_uri) => {
        const relativePath = workspace.asRelativePath(file_uri);
        const item = new CompletionItem(relativePath, CompletionItemKind.File);
        item.insertText = relativePath;
        return item;
      });
      return completionItems;
    }
  }));
  context.subscriptions.push(languages.registerCompletionItemProvider({language: "shadow", pattern: "**/*.shadow"}, {
    provideCompletionItems() {
      const completionItem = new CompletionItem("use", CompletionItemKind.Function);
      completionItem.insertText = new SnippetString('use("${1}")');
      completionItem.documentation = new MarkdownString("Import external files for AI context.");
      completionItem.detail = "Shadow Code AI: Use Function";
      return [completionItem];
    },
  }));
}

async function openShadowFile(uri: Uri, context: ExtensionContext) {
  const workspaceFolder = workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    window.showErrorMessage("Cannot enable Shadow Mode for a file that isn't inside a workspace folder.");
    return;
  }
  const shadowDir = join(workspaceFolder.uri.fsPath, ".shadows", dirname(workspace.asRelativePath(uri)));
  const shadowFilePath = join(shadowDir, basename(uri.fsPath) + ".shadow");
  mkdirSync(shadowDir, {recursive: true});
  if (!existsSync(shadowFilePath)) {
    const originalFileCode = (await workspace.openTextDocument(uri)).getText();
    writeFileSync(shadowFilePath, originalFileCode);
    context.workspaceState.update(`shadow_checkpoint_${Uri.file(shadowFilePath)}`, originalFileCode);
  }
  const doc = await workspace.openTextDocument(shadowFilePath);
  window.showTextDocument(doc, {viewColumn: ViewColumn.Beside});
}

async function copyCode(uri: Uri, context: ExtensionContext) {
  if (!uri.fsPath.endsWith(".shadow")) {
    window.showErrorMessage("Error: Document is not a '.shadow' file.");
    return;
  }
  const originalFileUri = Uri.file(uri.fsPath.replace(/[\\/]\.shadows[\\/]/, sep).replace(/\.shadow$/, ""));
  const originalFileCode = new TextDecoder().decode(await workspace.fs.readFile(originalFileUri));
  const edit = new WorkspaceEdit();
  edit.replace(uri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), originalFileCode);
  await workspace.applyEdit(edit);
  context.workspaceState.update(`shadow_checkpoint_${uri.toString()}`, originalFileCode);
}

async function convertShadowCode(service: ShadowCodeService, context: ExtensionContext, doc?: TextDocument) {
  if (!doc) {
    window.showErrorMessage("Error: No file opened.");
    return;
  }
  if (!doc.uri.fsPath.endsWith(".shadow")) {
    window.showErrorMessage("Error: Document is not a '.shadow' file.");
    return;
  }
  const pseudocode = doc.getText();
  const diff = buildDiff(context.workspaceState.get<string>(`shadow_checkpoint_${doc.uri.toString()}`), pseudocode);
  const originalFileUri = Uri.file(doc.uri.fsPath.replace(/[\\/]\.shadows[\\/]/, sep).replace(/\.shadow$/, ""));
  const originalFileCode = (await workspace.openTextDocument(originalFileUri)).getText();
  const langExtName = extname(originalFileUri.fsPath).slice(1);
  const output = await service.generateCode(langExtName, pseudocode, originalFileCode, originalFileUri, diff);
  if (output) {
    const edit = new WorkspaceEdit();
    edit.replace(originalFileUri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), output);
    await workspace.applyEdit(edit);
    await context.workspaceState.update(`shadow_checkpoint_${doc.uri.toString()}`, pseudocode);
    window.setStatusBarMessage("$(check) Successfully converted Shadow Code!", 3000);
  }
}

function buildDiff(oldText: string | undefined, newText: string): string {
  if (!oldText) {
    return newText.split("\n").map((line) => `+ ${line}`).join("\n");
  }
  const changes = diffLines(oldText, newText);
  const output: string[] = [];
  for (const change of changes) {
    const prefix = change.added ? '+ ' : (change.removed ? '- ' : '');
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
    for (const line of lines) {
      output.push(`${prefix}${line}`);
    }
  }
  return output.join('\n').trimEnd();
}

async function cleanupGhostCheckpoints(context: ExtensionContext) {
  for (const key of context.workspaceState.keys()) {
    if (key.startsWith("shadow_checkpoint_")) {
      const uriString = key.replace("shadow_checkpoint_", "");
      try {
        await workspace.fs.stat(Uri.parse(uriString));
      } catch {
        await context.workspaceState.update(key, undefined);
        console.log(`Cleaned up ghost checkpoint: ${uriString}`);
      }
    }
  }
}

export function deactivate() {
  console.log("Extension 'Shadow Code AI' deactivated.");
}