import {commands, ExtensionContext, Uri, ViewColumn, window, workspace} from "vscode";

const COMMAND_SHADOW_MODE = "ShadowCode.openInShadowMode";

export default function registerShadowModeCommand(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand(COMMAND_SHADOW_MODE, async (uri?: Uri) => {
    const fileUri = uri ?? window.activeTextEditor?.document.uri;
    if (!fileUri) {
      window.showWarningMessage("Cannot enable Shadow Mode. There is no active file in the editor.");
      return;
    }
    const workspaceFolder = workspace.getWorkspaceFolder(fileUri);
    if (!workspaceFolder) {
      window.showErrorMessage("Cannot enable Shadow Mode for a file that isn't inside a workspace folder.");
      return;
    }
    const shadowFileUri = Uri.joinPath(workspaceFolder.uri, ".shadows", workspace.asRelativePath(fileUri) + ".shadow");
    await workspace.fs.createDirectory(Uri.joinPath(shadowFileUri, ".."));
    try {
      await workspace.fs.stat(shadowFileUri);
    } catch {
      const originalFileCode = (await workspace.openTextDocument(fileUri)).getText();
      await workspace.fs.writeFile(shadowFileUri, new TextEncoder().encode(originalFileCode));
      await context.workspaceState.update(`shadow_checkpoint_${shadowFileUri.toString()}`, originalFileCode);
    }
    window.showTextDocument(shadowFileUri, {viewColumn: ViewColumn.Beside});
  }));
}