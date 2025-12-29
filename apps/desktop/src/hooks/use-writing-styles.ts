import {
  commands,
  type WritingStyle,
  type WritingStyleCategory,
  type UpdateWritingStyleInput,
} from "@/bindings";
import { useTauriQuery, useTauriMutation, queryKeys } from "@/lib/tauri-query";
import { useMemo } from "react";

export type { WritingStyle, WritingStyleCategory };

export function useWritingStyles() {
  const query = useTauriQuery(
    queryKeys.writingStyles.list(),
    commands.writingStylesList
  );

  const updateMutation = useTauriMutation(
    ({
      category,
      input,
    }: {
      category: WritingStyleCategory;
      input: UpdateWritingStyleInput;
    }) => commands.writingStylesUpdate(category, input),
    {
      invalidateKeys: [queryKeys.writingStyles.all],
    }
  );

  const { selectedStyles, customPrompts } = useMemo(() => {
    const selectedStyles: Record<string, string> = {};
    const customPrompts: Record<string, string> = {};

    for (const style of query.data ?? []) {
      selectedStyles[style.category] = style.selected_style;
      customPrompts[style.category] = style.custom_prompt ?? "";
    }

    return { selectedStyles, customPrompts };
  }, [query.data]);

  return {
    selectedStyles,
    customPrompts,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    updateStyle: async (
      category: WritingStyleCategory,
      selectedStyle: string,
      customPrompt?: string
    ) => {
      await updateMutation.mutateAsync({
        category,
        input: {
          selected_style: selectedStyle,
          custom_prompt: customPrompt ?? null,
          default_prompt: null,
        },
      });
    },
  };
}
