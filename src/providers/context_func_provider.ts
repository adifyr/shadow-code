import {CompletionItem, CompletionItemKind, ExtensionContext, languages, MarkdownString, SnippetString} from "vscode";

export default function registerContextFuncCompletionItemProvider(context: ExtensionContext) {
  context.subscriptions.push(languages.registerCompletionItemProvider({language: "shadow", pattern: "**/*.shadow"}, {
    provideCompletionItems() {
      const completionItem = new CompletionItem("context", CompletionItemKind.Function);
      completionItem.insertText = new SnippetString('context("${1}")');
      completionItem.documentation = new MarkdownString("Import external files for AI context.");
      completionItem.detail = "Shadow Code: Context Function";
      return [completionItem];
    },
  }));
}