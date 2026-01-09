import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import {DiffUtils} from './diff_utils';
import {GeminiService} from './gemini_service';
import {ShadowFileManager} from './shadow_file_manager';

/**
 * Handles code generation from shadow files
 */
export class CodeGenerator {
  constructor(
    private geminiService: GeminiService,
    private shadowFileManager: ShadowFileManager
  ) { }

  /**
   * Generate code from shadow file and apply to original file
   */
  async generateAndApply(shadowUri: vscode.Uri): Promise<void> {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    try {
      // Show processing indicator
      statusBarItem.text = "$(sync~spin) Shadow Code AI: Processing...";
      statusBarItem.show();

      // Get file paths
      const shadowFilePath = shadowUri.fsPath;
      const originalFilePath = ShadowFileManager.getOriginalFilePath(shadowFilePath);
      const originalUri = vscode.Uri.file(originalFilePath);

      // Read current contents
      const shadowContent = await fs.readFile(shadowFilePath, 'utf-8');
      const originalContent = await fs.readFile(originalFilePath, 'utf-8');

      // Get diff from previous shadow content
      const diff = this.shadowFileManager.getDiff(shadowFilePath, shadowContent);

      if (!diff) {
        console.log('No changes detected in shadow file');
        statusBarItem.text = "$(check) Shadow Code AI: No changes";
        setTimeout(() => statusBarItem.dispose(), 2000);
        return;
      }

      // Update stored shadow content
      this.shadowFileManager.updateShadowContent(shadowFilePath, shadowContent);

      // Generate code using Gemini
      statusBarItem.text = "$(sync~spin) Shadow Code AI: Generating code...";
      const generatedCode = await this.geminiService.generateCode(
        originalContent,
        shadowContent,
        originalFilePath,
        diff
      );

      // Apply changes to original file with diff preview
      await this.applyChangesWithDiff(originalUri, originalContent, generatedCode);

      statusBarItem.text = "$(check) Shadow Code AI: Complete";
      setTimeout(() => statusBarItem.dispose(), 3000);

    } catch (error) {
      statusBarItem.dispose();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Shadow Code AI Error: ${errorMessage}`);
      console.error('Code generation error:', error);
    }
  }

  /**
   * Apply changes to the original file with inline diff preview
   */
  private async applyChangesWithDiff(
    originalUri: vscode.Uri,
    oldContent: string,
    newContent: string
  ): Promise<void> {
    if (!DiffUtils.hasChanges(oldContent, newContent)) {
      vscode.window.showInformationMessage('No changes to apply');
      return;
    }

    // Open the original document
    const document = await vscode.workspace.openTextDocument(originalUri);

    // Show diff first to let user review
    const diffSummary = DiffUtils.getDiffSummary(oldContent, newContent);
    const shouldApply = await vscode.window.showInformationMessage(
      `Shadow Code AI wants to apply changes: ${diffSummary}`,
      'Apply',
      'Review',
      'Cancel'
    );

    if (shouldApply === 'Cancel') {
      return;
    }

    if (shouldApply === 'Review') {
      // Show side-by-side diff
      await this.showDiff(originalUri, oldContent, newContent);

      // Ask again after review
      const applyAfterReview = await vscode.window.showInformationMessage(
        'Apply these changes?',
        'Apply',
        'Cancel'
      );

      if (applyAfterReview !== 'Apply') {
        return;
      }
    }

    // Apply the changes
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(originalUri, fullRange, newContent);

    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      await document.save();
      vscode.window.showInformationMessage('Changes applied successfully!');
    } else {
      vscode.window.showErrorMessage('Failed to apply changes');
    }
  }

  /**
   * Show side-by-side diff
   */
  private async showDiff(
    originalUri: vscode.Uri,
    oldContent: string,
    newContent: string
  ): Promise<void> {
    // Create temporary files for diff view
    const tempOldUri = originalUri.with({scheme: 'untitled', path: originalUri.path + '.old'});
    const tempNewUri = originalUri.with({scheme: 'untitled', path: originalUri.path + '.new'});

    // Open diff editor
    await vscode.commands.executeCommand(
      'vscode.diff',
      tempOldUri,
      tempNewUri,
      'Shadow Code AI: Review Changes'
    );

    // Write content to the temporary editors
    const editors = vscode.window.visibleTextEditors;
    for (const editor of editors) {
      if (editor.document.uri.toString() === tempOldUri.toString()) {
        await editor.edit(editBuilder => {
          editBuilder.insert(new vscode.Position(0, 0), oldContent);
        });
      } else if (editor.document.uri.toString() === tempNewUri.toString()) {
        await editor.edit(editBuilder => {
          editBuilder.insert(new vscode.Position(0, 0), newContent);
        });
      }
    }
  }
}