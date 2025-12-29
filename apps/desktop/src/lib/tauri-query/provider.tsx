import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClient } from "./client";
import { setupEventSync } from "./event-sync";

interface TauriQueryProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that sets up React Query with Tauri event synchronization
 * Use this in both main.tsx and widget.tsx to keep caches in sync
 */
export function TauriQueryProvider({ children }: TauriQueryProviderProps) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    setupEventSync().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
