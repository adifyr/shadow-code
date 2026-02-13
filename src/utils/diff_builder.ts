import {diffLines} from "diff";

export function buildDiff(oldText: string | undefined, newText: string): string {
  const importRegex = /^\s*import\(.*?\)(\r?\n|$)/gm;
  const oldTextRefined = oldText?.replace(importRegex, "").trim();
  const newTextRefined = newText.replace(importRegex, "").trim();
  if (!oldTextRefined) {
    return newTextRefined.split(/\r?\n/).map((line) => `+ ${line}`).join("\n");
  }
  const changes = diffLines(oldTextRefined, newTextRefined);
  const lineDiffs: string[] = [];
  for (const change of changes) {
    const prefix = change.added ? "+ " : (change.removed ? "- " : "  ");
    const lines = change.value.replace(/\r?\n$/, "").split(/\r?\n/);
    lineDiffs.push(...lines.map((line) => line.length > 0 ? `${prefix}${line}` : prefix.trimEnd()));
  }
  return lineDiffs.join('\n').trimEnd();
}