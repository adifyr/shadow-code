import {CompletionItem, CompletionItemKind, ExtensionContext, languages, MarkdownString, SnippetString} from "vscode";

export default function registerImportFuncCompletionItemProvider(context: ExtensionContext) {
  context.subscriptions.push(languages.registerCompletionItemProvider({language: "shadow", pattern: "**/*.shadow"}, {
    provideCompletionItems() {
      const completionItem = new CompletionItem("import", CompletionItemKind.Function);
      completionItem.insertText = new SnippetString('import("${1}")');
      completionItem.documentation = new MarkdownString("Import external files for AI context.");
      completionItem.detail = "Shadow Code: Import Function";
      return [completionItem];
    },
  }));
}