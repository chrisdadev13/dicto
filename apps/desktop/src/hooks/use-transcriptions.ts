import { commands, type Transcription as DbTranscription } from "@/bindings";
import {
  useTauriQuery,
  useTauriMutation,
  queryKeys,
  unwrapResult,
} from "@/lib/tauri-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";

// Frontend Transcription type with Date
export interface Transcription {
  id: string;
  text: string;
  formattedText: string;
  createdAt: Date;
}

export interface Analytics {
  totalTranscriptions: number;
  totalWords: number;
}

const PAGE_SIZE = 20;

// Transform DB transcription to frontend type
function mapTranscription(t: DbTranscription): Transcription {
  return {
    id: t.id,
    text: t.text,
    formattedText: t.formatted_text ?? t.text,
    createdAt: new Date(t.created_at * 1000),
  };
}

export function useTranscriptions() {
  const queryClient = useQueryClient();

  // Paginated transcriptions using infinite query
  const infiniteQuery = useInfiniteQuery({
    queryKey: queryKeys.transcriptions.list(),
    queryFn: async ({ pageParam = 0 }) => {
      const result = await commands.transcriptionsList({
        limit: PAGE_SIZE,
        offset: pageParam,
      });
      return unwrapResult(result);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    initialPageParam: 0,
  });

  // Analytics query
  const analyticsQuery = useTauriQuery(
    queryKeys.transcriptions.analytics(),
    commands.transcriptionsAnalytics
  );

  // Delete mutation
  const deleteMutation = useTauriMutation(commands.transcriptionsDelete, {
    invalidateKeys: [
      queryKeys.transcriptions.list(),
      queryKeys.transcriptions.analytics(),
    ],
  });

  // Flatten paginated results
  const transcriptions = useMemo(
    () =>
      (infiniteQuery.data?.pages ?? []).flatMap((page) =>
        page.items.map(mapTranscription)
      ),
    [infiniteQuery.data]
  );

  const analytics: Analytics = useMemo(
    () => ({
      totalTranscriptions: analyticsQuery.data?.total_count ?? 0,
      totalWords: analyticsQuery.data?.total_words ?? 0,
    }),
    [analyticsQuery.data]
  );

  const refetch = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.transcriptions.list() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transcriptions.analytics() }),
    ]);
  }, [queryClient]);

  return {
    transcriptions,
    analytics,
    loading: infiniteQuery.isLoading,
    error: infiniteQuery.error?.message ?? null,
    refetch,
    remove: async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    loadMore: () => infiniteQuery.fetchNextPage(),
    hasMore: infiniteQuery.hasNextPage ?? false,
  };
}
