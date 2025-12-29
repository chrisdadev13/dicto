import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./styles/globals.css";

import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { TauriQueryProvider } from "./lib/tauri-query";
import { routeTree } from "./routeTree.gen";
import { setupBetterAuthTauri } from "@daveyplate/better-auth-tauri";
import { authClient } from "./lib/auth-client";



const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

setupBetterAuthTauri({
  authClient, // Your Better Auth client instance
  scheme: "dicto", // Must match the scheme in your server config
  debugLogs: true, // Optional: Enable debug logs
  mainWindowLabel: "main", // Optional: Your main window label (default: "main")
  onRequest: (href) => {
    console.log("Auth request:", href);
  },
  onSuccess: (callbackURL) => {
    console.log("Auth successful, callback URL:", callbackURL);
    // Handle successful authentication
    window.location.href = callbackURL as string
  },
  onError: (error) => {
    console.error("Auth error:", error);
    // Handle authentication error
  },
});

// document.addEventListener('contextmenu', (e) => e.preventDefault())
// document.addEventListener('keydown', (e) => {
//   if ((e.metaKey || e.ctrlKey) && e.key === 'r') e.preventDefault()
//   if (e.key === 'F5') e.preventDefault()
//   if ((e.metaKey && e.altKey && e.key === 'i') ||
//       (e.ctrlKey && e.shiftKey && e.key === 'I') ||
//       e.key === 'F12') e.preventDefault()
// })

const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <TauriQueryProvider>
        <TooltipProvider>
            <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster position="bottom-right" />
      </TauriQueryProvider>
    </StrictMode>,
  );
}
