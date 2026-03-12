import {CompletionItem, CompletionItemKind, ExtensionContext, languages, workspace} from "vscode";

export default function registerContextFilesCompletionItemProvider(context: ExtensionContext) {
  context.subscriptions.push(languages.registerCompletionItemProvider({language: "shadow", pattern: "**/*.shadow"}, {
    async provideCompletionItems(document, position) {
      const lineText = document.lineAt(position.line).text;
      const textBeforeCursor = lineText.substring(0, position.character);
      const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
      if (!/context\([^)]*$/.test(textBeforeCursor) || quoteCount % 2 === 0) {
        return;
      }
      const files = await workspace.findFiles("**/*", "{**/node_modules/**,**/dist/**,**/build/**,**/bin/**}");
      const completionItems = files.map((uri) => {
        const relativePath = workspace.asRelativePath(uri);
        const item = new CompletionItem(relativePath, CompletionItemKind.File);
        item.insertText = relativePath;
        return item;
      });
      return completionItems;
    },
  }));
}