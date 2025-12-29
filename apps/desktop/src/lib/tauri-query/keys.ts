/**
 * Query key factories for consistent cache key management
 * Hierarchical structure enables fine-grained invalidation
 */
export const queryKeys = {
  // Notes
  notes: {
    all: ["notes"] as const,
    list: () => [...queryKeys.notes.all, "list"] as const,
    detail: (id: string) => [...queryKeys.notes.all, "detail", id] as const,
  },

  // Keyterms
  keyterms: {
    all: ["keyterms"] as const,
    list: (category?: string) =>
      category
        ? ([...queryKeys.keyterms.all, "list", category] as const)
        : ([...queryKeys.keyterms.all, "list"] as const),
    detail: (id: string) => [...queryKeys.keyterms.all, "detail", id] as const,
  },

  // Shortcuts
  shortcuts: {
    all: ["shortcuts"] as const,
    list: (category?: string) =>
      category
        ? ([...queryKeys.shortcuts.all, "list", category] as const)
        : ([...queryKeys.shortcuts.all, "list"] as const),
    detail: (id: string) => [...queryKeys.shortcuts.all, "detail", id] as const,
  },

  // Transcriptions
  transcriptions: {
    all: ["transcriptions"] as const,
    list: () => [...queryKeys.transcriptions.all, "list"] as const,
    detail: (id: string) =>
      [...queryKeys.transcriptions.all, "detail", id] as const,
    analytics: () => [...queryKeys.transcriptions.all, "analytics"] as const,
  },

  // Settings
  settings: {
    all: ["settings"] as const,
    list: () => [...queryKeys.settings.all, "list"] as const,
    byKey: (key: string) => [...queryKeys.settings.all, key] as const,
  },

  // Writing Styles
  writingStyles: {
    all: ["writingStyles"] as const,
    list: () => [...queryKeys.writingStyles.all, "list"] as const,
    byCategory: (category: string) =>
      [...queryKeys.writingStyles.all, category] as const,
  },

  // Keys Vault
  keysVault: {
    all: ["keysVault"] as const,
    list: () => [...queryKeys.keysVault.all, "list"] as const,
    byService: (service: string) =>
      [...queryKeys.keysVault.all, service] as const,
  },
} as const;
