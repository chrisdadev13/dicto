import { commands, type VaultService } from "@/bindings";
import { useTauriQuery, useTauriMutation, queryKeys } from "@/lib/tauri-query";
import { useCallback, useMemo } from "react";

export type Service = VaultService;
export type KeyType = "stt" | "llm";
export interface KeyEntry {
  service: Service;
  type: KeyType;
  hasKey: boolean;
}

// Map service to type
function getKeyType(service: string): KeyType {
  if (service === "deepgram") return "stt";
  return "llm"; // groq, openai, gemini
}

export function useKeysVault() {
  const query = useTauriQuery(queryKeys.keysVault.list(), commands.keysVaultList);

  const setMutation = useTauriMutation(commands.keysVaultSet, {
    invalidateKeys: [queryKeys.keysVault.all],
  });

  const deleteMutation = useTauriMutation(commands.keysVaultDelete, {
    invalidateKeys: [queryKeys.keysVault.all],
  });

  const keys: KeyEntry[] = useMemo(
    () =>
      (query.data ?? []).map((k) => ({
        service: k.service as Service,
        type: getKeyType(k.service),
        hasKey: k.has_key,
      })),
    [query.data]
  );

  const getKey = useCallback(async (service: Service): Promise<string | null> => {
    const result = await commands.keysVaultGet(service);
    if (result.status === "error") return null;
    return result.data;
  }, []);

  const hasKey = useCallback(
    (service: Service): boolean => {
      return keys.some((k) => k.service === service && k.hasKey);
    },
    [keys]
  );

  const getKeysByType = useCallback(
    (type: KeyType): KeyEntry[] => {
      return keys.filter((k) => k.type === type);
    },
    [keys]
  );

  return {
    keys,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    getKey,
    setKey: async (service: Service, apiKey: string) => {
      await setMutation.mutateAsync({ service, api_key: apiKey });
    },
    removeKey: async (service: Service) => {
      await deleteMutation.mutateAsync(service);
    },
    hasKey,
    getKeysByType,
  };
}
