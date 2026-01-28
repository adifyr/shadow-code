import {diffLines} from "diff";
import {existsSync, mkdirSync, writeFileSync} from "fs";
import {basename, dirname, extname, join} from "path";
import {commands, ExtensionContext, ProgressLocation, Range, TextDocument, Uri, ViewColumn, window, workspace, WorkspaceEdit} from "vscode";
import {ShadowCodeService} from "./service";

export function activate(context: ExtensionContext) {
  // Initialize the Shadow Code Service.
  console.log("Extension 'Shadow Code AI' activated.");
  const service = ShadowCodeService.initialize(context.extensionPath);
  if (!service) {return;}

  // Register commands.
  context.subscriptions.push(commands.registerCommand("shadowCodeAI.openInShadowMode", openShadowFile));
  context.subscriptions.push(commands.registerCommand("shadowCodeAI.copyCode", copyCode));
  context.subscriptions.push(commands.registerCommand("shadowCodeAI.generateCode", () => {
    window.withProgress({location: ProgressLocation.Window, title: "Shadow Code AI"}, async (progress) => {
      progress.report({message: "Converting Shadow Code"});
      await convertShadowCode(service, context, window.activeTextEditor?.document);
    });
  }));
}

export async function openShadowFile(uri: Uri) {
  const workspaceFolder = workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    window.showErrorMessage("Cannot enable Shadow Mode for a file that isn't inside a workspace folder.");
    return;
  }
  const shadowDir = join(workspaceFolder.uri.fsPath, ".shadow", dirname(workspace.asRelativePath(uri)));
  const shadowFilePath = join(shadowDir, basename(uri.fsPath) + ".shadow");
  mkdirSync(shadowDir, {recursive: true});
  if (!existsSync(shadowFilePath)) {
    writeFileSync(shadowFilePath, '');
  }
  const doc = await workspace.openTextDocument(shadowFilePath);
  window.showTextDocument(doc, {viewColumn: ViewColumn.Beside});
}

async function copyCode(uri: Uri) {
  if (!uri.fsPath.endsWith(".shadow")) {
    window.showErrorMessage("Error: Document is not a '.shadow' file.");
    return;
  }
  const [_, originalFileCode, __] = await getOriginalFile(uri);
  const edit = new WorkspaceEdit();
  edit.replace(uri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), originalFileCode);
  await workspace.applyEdit(edit);
}

async function convertShadowCode(service: ShadowCodeService, context: ExtensionContext, document?: TextDocument) {
  if (!document) {
    window.showErrorMessage("Error: No file opened.");
    return;
  }
  if (!document.uri.fsPath.endsWith(".shadow")) {
    window.showErrorMessage("Error: Document is not a '.shadow' file.");
    return;
  }
  const pseudocode = document.getText();
  const prevPseudocode = context.workspaceState.get<string>(getCacheKey(document.uri));
  const diff = buildDiff(prevPseudocode, pseudocode);
  const [originalFileUri, originalFileCode, langExtName] = await getOriginalFile(document.uri);
  const output = await service.generateCode(langExtName, pseudocode, originalFileCode, originalFileUri, diff);
  if (output) {
    const edit = new WorkspaceEdit();
    edit.replace(originalFileUri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), output);
    await workspace.applyEdit(edit);
    await context.workspaceState.update(getCacheKey(document.uri), pseudocode);
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

function getCacheKey(uri: Uri): string {
  return `shadow_checkpoint_${uri.toString()}`;
}

async function getOriginalFile(shadowFileUri: Uri): Promise<[Uri, string, string]> {
  const originalFileUri = Uri.file(shadowFileUri.fsPath.replace("/.shadow/", "/").replace(".shadow", ""));
  const langExtName = extname(originalFileUri.fsPath).slice(1);
  const originalFileContents = await workspace.fs.readFile(originalFileUri);
  return [originalFileUri, new TextDecoder().decode(originalFileContents), langExtName];
}

export function deactivate() {
  console.log("Extension 'Shadow Code AI' deactivated.");
}