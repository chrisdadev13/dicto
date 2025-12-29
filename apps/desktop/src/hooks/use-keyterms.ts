import {
  commands,
  type Keyterm,
  type UpdateKeytermInput,
  type KeytermCategory,
} from "@/bindings";
import { useTauriQuery, useTauriMutation, queryKeys } from "@/lib/tauri-query";

export type { Keyterm, KeytermCategory };

export function useKeyterms(category?: KeytermCategory) {
  const query = useTauriQuery(
    category ? queryKeys.keyterms.list(category) : queryKeys.keyterms.list(),
    () => commands.keytermsList(category ?? null)
  );

  const createMutation = useTauriMutation(commands.keytermsCreate, {
    invalidateKeys: [queryKeys.keyterms.all],
  });

  const updateMutation = useTauriMutation(
    ({ id, input }: { id: string; input: UpdateKeytermInput }) =>
      commands.keytermsUpdate(id, input),
    {
      invalidateKeys: [queryKeys.keyterms.all],
    }
  );

  const deleteMutation = useTauriMutation(commands.keytermsDelete, {
    invalidateKeys: [queryKeys.keyterms.all],
  });

  return {
    keyterms: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    create: async (text: string, category: KeytermCategory) => {
      const result = await createMutation.mutateAsync({ text, category });
      return result.id;
    },
    update: async (id: string, text: string, category: KeytermCategory) => {
      await updateMutation.mutateAsync({ id, input: { text, category } });
    },
    remove: async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
  };
}
