import {ExtensionContext, Uri, workspace} from "vscode";

export default async function cleanupGhostCheckpoints(context: ExtensionContext) {
  for (const key of context.workspaceState.keys()) {
    if (key.startsWith("shadow_checkpoint_")) {
      const uriString = key.replace("shadow_checkpoint_", "");
      try {
        await workspace.fs.stat(Uri.parse(uriString));
      } catch {
        await context.workspaceState.update(key, undefined);
        console.log(`Cleaned up ghost checkpoint: ${uriString}`);
      }
    }
  }
}