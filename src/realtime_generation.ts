import {Range, Uri, workspace, WorkspaceEdit} from "vscode";
import {GeminiService} from "./gemini_service";

type ShadowFileState = {
  shadow_file_uri: Uri;
  original_file_uri: Uri;
  language: string;
  last_processed_content: string;
  timer_id: NodeJS.Timeout | null;
  is_generating: boolean;
};

const active_shadow_files = new Map<string, ShadowFileState>();
const GEN_INTERVAL = 4000;

export function start_realtime_generation(
  shadow_file_uri: Uri,
  original_file_uri: Uri,
  gemini_service: GeminiService,
  language: string,
) {
  const key = shadow_file_uri.fsPath;
  if (active_shadow_files.has(key)) {return;}
  const state: ShadowFileState = {
    shadow_file_uri,
    original_file_uri,
    language,
    last_processed_content: '',
    timer_id: null,
    is_generating: false,
  };
  active_shadow_files.set(key, state);
  console.log(`Active Shadow Files Being Listened To: ${active_shadow_files.keys.length}`);
  schedule_next_generation(state, gemini_service);
}

function schedule_next_generation(state: ShadowFileState, gemini_service: GeminiService) {
  state.timer_id = setTimeout(async () => {
    await process_generation(state, gemini_service);
    schedule_next_generation(state, gemini_service);
  }, GEN_INTERVAL);
}

async function process_generation(state: ShadowFileState, gemini_service: GeminiService) {
  if (state.is_generating) {return;}

  const shadow_doc = await workspace.openTextDocument(state.shadow_file_uri);
  const shadow_code = shadow_doc.getText();
  if (shadow_code === state.last_processed_content) {return;}

  console.log("Detected change in shadow file. Generating code..");

  state.is_generating = true;
  try {
    const original_doc = await workspace.openTextDocument(state.original_file_uri);
    const existing_code = original_doc.getText();
    const generated_code = await gemini_service.process_pseudocode(state.language, shadow_code, existing_code);
    if (generated_code) {
      const edit = new WorkspaceEdit();
      edit.replace(state.original_file_uri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), generated_code);
      await workspace.applyEdit(edit);
      state.last_processed_content = shadow_code;
    }
  } catch (error) {
    console.error(`Generation Error: ${error}`);
  } finally {
    state.is_generating = false;
  }
}


export function stop_realtime_generation(shadow_file_uri: Uri) {
  const key = shadow_file_uri.fsPath;
  const state = active_shadow_files.get(key);
  if (state?.timer_id) {
    clearTimeout(state.timer_id);
  }
  active_shadow_files.delete(key);
  console.log(`Active Shadow Files Being Listened To: ${active_shadow_files.keys.length}`);
}