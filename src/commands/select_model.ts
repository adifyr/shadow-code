import {commands, ExtensionContext} from "vscode";
import {AIService} from "../services/ai_service";

const COMMAND_SELECT_MODEL = "ShadowCode.selectModel";

export default function registerSelectModelCommand(context: ExtensionContext, service: AIService) {
  context.subscriptions.push(commands.registerCommand(COMMAND_SELECT_MODEL, () => service.selectModel()));
}