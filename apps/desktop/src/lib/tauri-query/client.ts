import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance for both webviews
 * Each webview gets its own instance, but they sync via Tauri events
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnMount: true,
      refetchOnWindowFocus: false, // Desktop app, not browser
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
