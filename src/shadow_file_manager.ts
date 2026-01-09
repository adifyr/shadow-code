import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {DiffUtils} from './diff_utils';

/**
 * Manages shadow files and their relationship to original files
 */
export class ShadowFileManager {
  private shadowFileContents: Map<string, string> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get the shadow file path for a given original file
   */
  static getShadowFilePath(originalFilePath: string): string {
    return `${originalFilePath}.shadow`;
  }

  /**
   * Get the original file path from a shadow file path
   */
  static getOriginalFilePath(shadowFilePath: string): string {
    return shadowFilePath.replace(/\.shadow$/, '');
  }

  /**
   * Check if a file is a shadow file
   */
  static isShadowFile(filePath: string): boolean {
    return filePath.endsWith('.shadow');
  }

  /**
   * Create or open a shadow file for the given original file
   */
  async createShadowFile(originalUri: vscode.Uri): Promise<vscode.Uri> {
    const shadowPath = ShadowFileManager.getShadowFilePath(originalUri.fsPath);
    const shadowUri = vscode.Uri.file(shadowPath);

    try {
      // Check if shadow file already exists
      await fs.access(shadowPath);
      console.log('Shadow file already exists:', shadowPath);
    } catch {
      // Shadow file doesn't exist, create it
      try {
        // Read the original file content
        const originalContent = await fs.readFile(originalUri.fsPath, 'utf-8');

        // Create shadow file with original content as template
        const shadowContent = this.generateInitialShadowContent(originalContent, originalUri.fsPath);
        await fs.writeFile(shadowPath, shadowContent, 'utf-8');

        // Store initial content
        this.shadowFileContents.set(shadowPath, shadowContent);

        console.log('Created shadow file:', shadowPath);
      } catch (error) {
        throw new Error(`Failed to create shadow file: ${error}`);
      }
    }

    return shadowUri;
  }

  /**
   * Generate initial shadow file content
   * Adds helpful comments to guide the user
   */
  private generateInitialShadowContent(originalContent: string, filePath: string): string {
    const fileName = path.basename(filePath);
    const header = `// Shadow File for: ${fileName}
// Write pseudo-code here and it will be converted to actual code
// Use TODO comments to give specific instructions to the AI
// Example: // TODO: Add error handling here

`;

    // If original file is empty, provide a template
    if (!originalContent.trim()) {
      return header + '// Start writing your pseudo-code here\n';
    }

    return header + originalContent;
  }

  /**
   * Open shadow file in split view
   */
  async openInSplitView(originalUri: vscode.Uri, shadowUri: vscode.Uri): Promise<void> {
    // Get the active editor
    const activeEditor = vscode.window.activeTextEditor;
    const viewColumn = activeEditor?.viewColumn || vscode.ViewColumn.One;

    // Open shadow file on the left
    const shadowDoc = await vscode.workspace.openTextDocument(shadowUri);
    await vscode.window.showTextDocument(shadowDoc, {
      viewColumn: viewColumn,
      preserveFocus: false,
      preview: false
    });

    // Open original file on the right
    const originalDoc = await vscode.workspace.openTextDocument(originalUri);
    await vscode.window.showTextDocument(originalDoc, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
      preview: false
    });
  }

  /**
   * Get the diff between the current and previous shadow file content
   */
  getDiff(shadowFilePath: string, currentContent: string): string {
    const previousContent = this.shadowFileContents.get(shadowFilePath) || '';

    if (!DiffUtils.hasChanges(previousContent, currentContent)) {
      return '';
    }

    return DiffUtils.computeDiff(previousContent, currentContent, path.basename(shadowFilePath));
  }

  /**
   * Update stored shadow file content
   */
  updateShadowContent(shadowFilePath: string, content: string): void {
    this.shadowFileContents.set(shadowFilePath, content);
  }

  /**
   * Get stored shadow file content
   */
  getShadowContent(shadowFilePath: string): string {
    return this.shadowFileContents.get(shadowFilePath) || '';
  }

  /**
   * Set up debounced change listener for a shadow file
   */
  setupDebounce(
    shadowFilePath: string,
    callback: () => void,
    delay: number
  ): vscode.Disposable {
    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.fsPath === shadowFilePath) {
        // Clear existing timer
        const existingTimer = this.debounceTimers.get(shadowFilePath);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
          callback();
          this.debounceTimers.delete(shadowFilePath);
        }, delay);

        this.debounceTimers.set(shadowFilePath, timer);
      }
    });

    return changeListener;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.shadowFileContents.clear();
  }
}