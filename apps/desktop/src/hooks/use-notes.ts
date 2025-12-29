import {
  commands,
  type Note as DbNote,
  type UpdateNoteInput,
} from "@/bindings";
import { useTauriQuery, useTauriMutation, queryKeys } from "@/lib/tauri-query";
import { useMemo, useCallback } from "react";

// Frontend Note type with Date objects for backward compatibility
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Transform DB note to frontend Note
function mapNote(n: DbNote): Note {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    createdAt: new Date(n.created_at * 1000),
    updatedAt: new Date(n.updated_at * 1000),
  };
}

export function useNotes() {
  const query = useTauriQuery(queryKeys.notes.list(), commands.notesList);

  const notes = useMemo(
    () => (query.data ?? []).map(mapNote),
    [query.data]
  );

  const createMutation = useTauriMutation(commands.notesCreate, {
    invalidateKeys: [queryKeys.notes.all],
  });

  const updateMutation = useTauriMutation(
    ({ id, input }: { id: string; input: UpdateNoteInput }) =>
      commands.notesUpdate(id, input),
    {
      invalidateKeys: [queryKeys.notes.all],
    }
  );

  const deleteMutation = useTauriMutation(commands.notesDelete, {
    invalidateKeys: [queryKeys.notes.all],
  });

  const getById = useCallback(
    async (id: string): Promise<Note | null> => {
      const result = await commands.notesGet(id);
      if (result.status === "error") {
        if (result.error.code === "NotFound") return null;
        throw result.error;
      }
      return mapNote(result.data);
    },
    []
  );

  return {
    notes,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    create: async (data: { title: string; content: string }) => {
      const result = await createMutation.mutateAsync(data);
      return result.id;
    },
    update: async (id: string, data: { title?: string; content?: string }) => {
      await updateMutation.mutateAsync({
        id,
        input: {
          title: data.title ?? null,
          content: data.content ?? null,
        },
      });
    },
    remove: async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    getById,
  };
}
