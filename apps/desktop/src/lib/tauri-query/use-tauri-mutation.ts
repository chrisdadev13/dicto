import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Result, CommandError } from "@/bindings";
import type { TauriMutationOptions } from "./types";
import { unwrapResult } from "./utils";

/**
 * React Query mutation wrapper for Tauri commands
 *
 * @example
 * const createNote = useTauriMutation(commands.notesCreate, {
 *   invalidateKeys: [["notes", "list"]],
 * });
 *
 * // Usage
 * createNote.mutate({ title: "New Note", content: "..." });
 */
export function useTauriMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<Result<TData, CommandError>>,
  options?: TauriMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();

  const mutation = useMutation<TData, CommandError, TVariables>({
    mutationFn: async (variables) => {
      const result = await mutationFn(variables);
      return unwrapResult(result);
    },
    onSuccess: async (data, variables) => {
      // Invalidate specified keys
      if (options?.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          await queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }
      // Call user's onSuccess
      await options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error, variables);
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    data: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
