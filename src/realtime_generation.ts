import {Disposable, Range, Uri, workspace, WorkspaceEdit} from "vscode";
import {ShadowCodeService} from "./shadow_code_service";

type ShadowFileState = {
  shadow_file_uri: Uri;
  original_file_uri: Uri;
  lang_ext_name: string;
  last_processed_content: string;
  timer_id: NodeJS.Timeout | null;
  is_generating: boolean;
  change_listener: Disposable | null;
};

const active_shadow_files = new Map<string, ShadowFileState>();
const DEBOUNCE_DELAY = 2000;

export function start_realtime_generation(
  shadow_file_uri: Uri,
  original_file_uri: Uri,
  shadow_code_service: ShadowCodeService,
  lang_ext_name: string,
) {
  const key = shadow_file_uri.fsPath;
  if (active_shadow_files.has(key)) {return;}

  const state: ShadowFileState = {
    shadow_file_uri,
    original_file_uri,
    lang_ext_name,
    last_processed_content: '',
    timer_id: null,
    is_generating: false,
    change_listener: null,
  };

  state.change_listener = workspace.onDidChangeTextDocument((event) => {
    if (event.document.uri.fsPath === shadow_file_uri.fsPath) {
      reset_debounce_timer(state, shadow_code_service);
    }
  });

  active_shadow_files.set(key, state);
  console.log(`Active Shadow Files: ${active_shadow_files.size}`);
}

function reset_debounce_timer(state: ShadowFileState, shadow_code_service: ShadowCodeService) {
  if (state.timer_id) {clearTimeout(state.timer_id);}
  state.timer_id = setTimeout(async () => {
    if (state.is_generating) {return;}
    const pseudocode = (await workspace.openTextDocument(state.shadow_file_uri)).getText();
    if (pseudocode === state.last_processed_content) {return;}

    console.log("Detected change in shadow file. Generating code...");
    state.is_generating = true;
    try {
      const existing_code = (await workspace.openTextDocument(state.original_file_uri)).getText();
      const generated_code = await shadow_code_service.generate_code(state.lang_ext_name, pseudocode, existing_code);
      if (generated_code) {
        const edit = new WorkspaceEdit();
        edit.replace(state.original_file_uri, new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), generated_code);
        await workspace.applyEdit(edit);
        state.last_processed_content = pseudocode;
        console.log("Code generation complete!");
      }
    } catch (error) {
      console.error(`Generation Error: ${error}`);
    } finally {
      state.is_generating = false;
    }
  }, DEBOUNCE_DELAY);
}

export function stop_realtime_generation(shadow_file_uri: Uri) {
  const state = active_shadow_files.get(shadow_file_uri.fsPath);
  if (state?.timer_id) {
    clearTimeout(state.timer_id);
  }
  if (state?.change_listener) {
    state.change_listener.dispose();
  }
  active_shadow_files.delete(shadow_file_uri.fsPath);
  console.log(`Stopped Listening To Shadow File: ${shadow_file_uri.path}`);
}