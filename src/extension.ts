import {ExtensionContext} from "vscode";
import registerConvertShadowCodeCommand from "./commands/convert_shadow_code";
import registerCopyCodeCommand from "./commands/copy_code";
import registerShadowModeCommand from "./commands/shadow_mode";
import registerContextFilesCompletionItemProvider from "./providers/context_files_provider";
import registerContextFuncCompletionItemProvider from "./providers/context_func_provider";
import {AIService} from "./services/ai_service";
import cleanupGhostCheckpoints from "./utils/cleanup";
import {Logger} from "./utils/logger";

export function activate(context: ExtensionContext) {
  // Initialize Shadow Code Service.
  Logger.info("Extension 'Shadow Code AI' activated.");
  const service = new AIService(context.extensionPath);
  if (!service) {return;}

  // Clean up any ghost checkpoints.
  cleanupGhostCheckpoints(context).catch((err) => Logger.error("Error cleaning up ghost checkpoints.", err));

  // Register Commands.
  registerShadowModeCommand(context);
  registerConvertShadowCodeCommand(context, service);
  registerCopyCodeCommand(context);

  // Register Completion Item Providers.
  registerContextFilesCompletionItemProvider(context);
  registerContextFuncCompletionItemProvider(context);
}

export function deactivate() {
  console.log("Extension 'Shadow Code AI' deactivated.");
}