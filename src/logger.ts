import * as vscode from 'vscode';

export class Logger {
  private static channel: vscode.OutputChannel;

  public static info(message: string) {
    this.appendLine("INFO", message);
  }

  public static error(message: string, error?: any) {
    this.appendLine("ERROR", message);
    if (error) {
      this.appendLine("TRACE", error instanceof Error ? error.stack || error.message : JSON.stringify(error));
    }
    // Force the channel to pop open on errors so your testers see it immediately
    this.channel.show(true);
  }

  private static appendLine(level: string, message: string) {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel("shadow_code_ai");
    }
    const timestamp = new Date().toLocaleTimeString();
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }
}