import {extname} from "path";
import {CompletionItem, CompletionItemKind, ExtensionContext, languages, workspace} from "vscode";

export default function registerImportFilesCompletionItemProvider(context: ExtensionContext) {
  context.subscriptions.push(languages.registerCompletionItemProvider({language: "shadow", pattern: "**/*.shadow"}, {
    async provideCompletionItems(document, position) {
      const lineText = document.lineAt(position.line).text;
      const textBeforeCursor = lineText.substring(0, position.character);
      const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
      if (!/import\([^)]*$/.test(textBeforeCursor) || quoteCount % 2 === 0) {
        return;
      }
      const extName = extname(document.uri.fsPath.replace(/\.shadow$/, "")).slice(1);
      const files = await workspace.findFiles({
        java: "src/main/java/**/*.java",
        dart: "lib/**/*.dart",
        js: "src/**/*.js",
        ts: "src/**/*.ts",
        py: "src/**/*.py",
        rs: "src/**/*.rs",
      }[extName] ?? "**/*");
      const completionItems = files.map((file_uri) => {
        const relativePath = workspace.asRelativePath(file_uri);
        const item = new CompletionItem(relativePath, CompletionItemKind.File);
        item.insertText = relativePath;
        return item;
      });
      return completionItems;
    },
  }));
}