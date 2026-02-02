import {diffLines} from "diff";

export function buildDiff(oldText: string | undefined, newText: string): string {
  const contextRegex = /^\s*context\(.*?\)(\r?\n|$)/gm;
  const oldTextRefined = oldText?.replace(contextRegex, "").trimEnd();
  const newTextRefined = newText.replace(contextRegex, "").trimEnd();
  if (!oldTextRefined) {
    return newTextRefined.split(/\r?\n/).map((line) => `+ ${line}`).join("\n");
  }
  const changes = diffLines(oldTextRefined, newTextRefined);
  const lineDiffs: string[] = [];
  for (const change of changes) {
    const prefix = change.added ? "+ " : (change.removed ? "- " : "  ");
    const lines = change.value.split(/\r?\n/);
    lineDiffs.push(...lines.map((line) => `${prefix}${line}`));
  }
  return lineDiffs.join('\n').trim();
}