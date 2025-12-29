import {
  commands,
  type Shortcut,
  type UpdateShortcutInput,
  type ShortcutCategory,
} from "@/bindings";
import { useTauriQuery, useTauriMutation, queryKeys } from "@/lib/tauri-query";

export type { Shortcut, ShortcutCategory };

export function useShortcuts(category?: ShortcutCategory) {
  const query = useTauriQuery(
    category ? queryKeys.shortcuts.list(category) : queryKeys.shortcuts.list(),
    () => commands.shortcutsList(category ?? null)
  );

  const createMutation = useTauriMutation(commands.shortcutsCreate, {
    invalidateKeys: [queryKeys.shortcuts.all],
  });

  const updateMutation = useTauriMutation(
    ({ id, input }: { id: string; input: UpdateShortcutInput }) =>
      commands.shortcutsUpdate(id, input),
    {
      invalidateKeys: [queryKeys.shortcuts.all],
    }
  );

  const deleteMutation = useTauriMutation(commands.shortcutsDelete, {
    invalidateKeys: [queryKeys.shortcuts.all],
  });

  return {
    shortcuts: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    create: async (trigger: string, replacement: string, category: ShortcutCategory) => {
      const result = await createMutation.mutateAsync({ trigger, replacement, category });
      return result.id;
    },
    update: async (id: string, trigger: string, replacement: string, category: ShortcutCategory) => {
      await updateMutation.mutateAsync({ id, input: { trigger, replacement, category } });
    },
    remove: async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
  };
}
