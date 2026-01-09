import * as Diff from 'diff';

/**
 * Utility functions for computing and handling diffs
 */
export class DiffUtils {
  /**
   * Compute unified diff between two strings
   */
  static computeDiff(oldContent: string, newContent: string, fileName: string = 'shadow'): string {
    const patch = Diff.createPatch(
      fileName,
      oldContent,
      newContent,
      'Previous version',
      'Current version'
    );
    return patch;
  }

  /**
   * Get a human-readable summary of changes
   */
  static getDiffSummary(oldContent: string, newContent: string): string {
    const changes = Diff.diffLines(oldContent, newContent);

    let added = 0;
    let removed = 0;
    let modified = 0;

    changes.forEach(change => {
      if (change.added) {
        added += change.count || 0;
      } else if (change.removed) {
        removed += change.count || 0;
      } else {
        modified += change.count || 0;
      }
    });

    return `+${added} -${removed} ~${modified} lines`;
  }

  /**
   * Check if there are any meaningful changes
   */
  static hasChanges(oldContent: string, newContent: string): boolean {
    return oldContent.trim() !== newContent.trim();
  }

  /**
   * Get structured diff information
   */
  static getStructuredDiff(oldContent: string, newContent: string): Diff.Change[] {
    return Diff.diffLines(oldContent, newContent);
  }
}