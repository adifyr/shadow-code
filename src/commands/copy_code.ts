import {sep} from "path";
import {commands, ExtensionContext, Range, Uri, window, workspace, WorkspaceEdit} from "vscode";

const COMMAND_COPY_CODE = "ShadowCodeAI.copyCode";

export default function registerCopyCodeCommand(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand(COMMAND_COPY_CODE, async (uri: Uri) => {
    if (!uri.fsPath.endsWith(".shadow")) {
      window.showErrorMessage("Error: Document is not a '.shadow' file.");
      return;
    }
    const originalFileUri = Uri.file(uri.fsPath.replace(/[\\/]\.shadows[\\/]/, sep).replace(/\.shadow$/, ""));
    const originalFileCode = (await workspace.openTextDocument(originalFileUri)).getText();
    const edit = new WorkspaceEdit();
    edit.replace(uri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), originalFileCode);
    await workspace.applyEdit(edit);
    await context.workspaceState.update(`shadow_checkpoint_${uri.toString()}`, originalFileCode);
  }));
}