import {extname, sep} from "path";
import {commands, ExtensionContext, ProgressLocation, TextDocument, Uri, window, workspace} from "vscode";
import {AIService} from "../services/ai_service";

const COMMAND_CONVERT_CODE = "ShadowCodeAI.convertShadowCode";

export default function registerConvertShadowCodeCommand(context: ExtensionContext, service: AIService) {
  context.subscriptions.push(commands.registerCommand(COMMAND_CONVERT_CODE, async () => {
    window.withProgress({location: ProgressLocation.Window, title: "Shadow Code AI"}, async (progress) => {
      progress.report({message: "Converting Shadow Code"});
      const doc = window.activeTextEditor?.document;
      if (!doc || !doc.uri.fsPath.endsWith(".shadow")) {
        window.showErrorMessage("Error: Document not found or is not a '.shadow' file.");
        return;
      }
      const pseudocode = doc.getText();
      const originalFileUri = Uri.file(doc.uri.fsPath.replace(/[\\/]\.shadows[\\/]/, sep).replace(/\.shadow$/, ""));
      const existingCode = (await workspace.openTextDocument(originalFileUri)).getText();
      const checkpointKey = "shadow_checkpoint_" + doc.uri.toString();
      const oldPseudocode = context.workspaceState.get<string>(checkpointKey);
      const langExtName = extname(originalFileUri.fsPath).slice(1);
      if (await service.convertShadowCode(langExtName, oldPseudocode, pseudocode, existingCode, originalFileUri)) {
        context.workspaceState.update(checkpointKey, pseudocode);
      }
    });
  }));
}

