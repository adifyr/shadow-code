import {existsSync, mkdirSync, writeFileSync} from "fs";
import {basename, dirname, join} from "path";
import {commands, ExtensionContext, Uri, ViewColumn, window, workspace} from "vscode";

const COMMAND_SHADOW_MODE = "ShadowCode.openInShadowMode";

export default function registerShadowModeCommand(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand(COMMAND_SHADOW_MODE, async (uri: Uri) => {
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
      await context.workspaceState.update(`shadow_checkpoint_${Uri.file(shadowFilePath)}`, originalFileCode);
    }
    const doc = await workspace.openTextDocument(shadowFilePath);
    window.showTextDocument(doc, {viewColumn: ViewColumn.Beside});
  }));
}