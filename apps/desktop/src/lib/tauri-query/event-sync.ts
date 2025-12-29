import { listen } from "@tauri-apps/api/event";
import { queryClient } from "./client";
import { queryKeys } from "./keys";

/**
 * Maps Tauri event names to query keys that should be invalidated
 * When one webview mutates data, events are emitted and both webviews invalidate their caches
 */
const EVENT_INVALIDATION_MAP: Record<string, readonly (readonly string[])[]> = {
  // Notes
  "notes:created": [queryKeys.notes.list()],
  "notes:updated": [queryKeys.notes.all],
  "notes:deleted": [queryKeys.notes.all],

  // Keyterms
  "keyterms:created": [queryKeys.keyterms.all],
  "keyterms:updated": [queryKeys.keyterms.all],
  "keyterms:deleted": [queryKeys.keyterms.all],

  // Shortcuts
  "shortcuts:created": [queryKeys.shortcuts.all],
  "shortcuts:updated": [queryKeys.shortcuts.all],
  "shortcuts:deleted": [queryKeys.shortcuts.all],

  // Transcriptions
  "transcriptions:created": [
    queryKeys.transcriptions.list(),
    queryKeys.transcriptions.analytics(),
  ],
  "transcriptions:updated": [queryKeys.transcriptions.all],
  "transcriptions:deleted": [
    queryKeys.transcriptions.all,
    queryKeys.transcriptions.analytics(),
  ],

  // Settings
  "settings:updated": [queryKeys.settings.all],

  // Writing Styles
  "writing_styles:updated": [queryKeys.writingStyles.all],

  // Keys Vault
  "keys_vault:updated": [queryKeys.keysVault.all],
  "keys_vault:deleted": [queryKeys.keysVault.all],
};

/**
 * Setup Tauri event listeners to invalidate React Query cache
 * This keeps both webviews (main + widget) in sync
 *
 * @returns Cleanup function to remove all listeners
 */
export async function setupEventSync(): Promise<() => void> {
  const unlisteners: Array<() => void> = [];

  for (const [eventName, keysToInvalidate] of Object.entries(
    EVENT_INVALIDATION_MAP
  )) {
    const unlisten = await listen(eventName, () => {
      for (const key of keysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: [...key] });
      }
    });
    unlisteners.push(unlisten);
  }

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}
