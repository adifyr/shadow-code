import {ExtensionContext} from "vscode";
import registerConvertShadowCodeCommand from "./commands/convert_shadow_code";
import registerCopyCodeCommand from "./commands/copy_code";
import registerShadowModeCommand from "./commands/shadow_mode";
import registerImportFilesCompletionItemProvider from "./providers/import_files_provider";
import registerImportFuncCompletionItemProvider from "./providers/import_func_provider";
import {AIService} from "./services/ai_service";
import cleanupGhostCheckpoints from "./utils/cleanup";
import {Logger} from "./utils/logger";
import registerSelectModelCommand from "./commands/select_model";

export function activate(context: ExtensionContext) {
  // Initialize Shadow Code Service.
  Logger.info("Extension 'Shadow Code' activated.");
  const service = new AIService(context.extensionPath);
  if (!service) {return;}

  // Clean up any ghost checkpoints.
  cleanupGhostCheckpoints(context);

  // Register Commands.
  registerShadowModeCommand(context);
  registerCopyCodeCommand(context);
  registerConvertShadowCodeCommand(context, service);
  registerSelectModelCommand(context, service);

  // Register Completion Item Providers.
  registerImportFilesCompletionItemProvider(context);
  registerImportFuncCompletionItemProvider(context);
}

export function deactivate() {
  Logger.info("Extension 'Shadow Code' deactivated.");
}