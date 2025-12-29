import { Link, useLocation } from "@tanstack/react-router";
import {
  BookOpenIcon,
  HelpCircleIcon,
  HomeIcon,
  PenBoxIcon,
  SettingsIcon,
  StickyNoteIcon,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { SettingsDialog } from "@/components/settings-dialog";
import { cn } from "@/lib/utils";
import { formatKey, sortKeys } from "@/lib/keyboard-utils";
import { useCurrentShortcut } from "@/hooks/use-current-shortcut";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { pathname } = useLocation();
  const [version, setVersion] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<"idle" | "holding" | "speaking" | "done">("idle");
  const { shortcut } = useCurrentShortcut();
  const sortedKeys = sortKeys(shortcut);
  const firstKeySymbol = sortedKeys.length > 0 ? formatKey(sortedKeys[0]) : "⌃";

  // Listen for recording events to update tutorial step
  useEffect(() => {
    if (!helpOpen) {
      setTutorialStep("idle");
      return;
    }

    let unlistenStart: (() => void) | undefined;
    let unlistenStop: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenStart = await listen("start-listening", () => {
        setTutorialStep("holding");
        // Transition to speaking after a brief moment
        setTimeout(() => setTutorialStep("speaking"), 300);
      });

      unlistenStop = await listen("stop-listening", () => {
        setTutorialStep("done");
        // Reset after showing completion
        setTimeout(() => setTutorialStep("idle"), 1500);
      });
    };

    setupListeners();

    return () => {
      unlistenStart?.();
      unlistenStop?.();
    };
  }, [helpOpen]);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = "1.0.0";
        setVersion(appVersion);
      } catch (error) {
        console.error("Error fetching app version:", error);
        setVersion("1.0.0"); // Fallback version
      }
    };

    fetchVersion();
  }, []);

  return (
    <Sidebar className="mt-10 border-r-0! bg-background" collapsible="icon">
      <SidebarContent className="gap-1.5 px-3 pt-1">
        <Link className="flex items-center gap-2" to="/home">
          <SidebarMenuButton isActive={pathname === "/home"} size="sm">
            <HomeIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Home</span>
          </SidebarMenuButton>
        </Link>

        <Link className="flex items-center gap-2" to="/keyterms">
          <SidebarMenuButton isActive={pathname === "/keyterms"} size="sm">
            <BookOpenIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Dictionary</span>
          </SidebarMenuButton>
        </Link>
        {/* <Link className="flex items-center gap-2" to="/shortcuts"> */}
        {/*   <SidebarMenuButton isActive={pathname === "/shortcuts"} size="sm"> */}
        {/*     <FileTextIcon size={16} strokeWidth={1.5} aria-hidden="true" /> */}
        {/*     <span>Shortcuts</span> */}
        {/*   </SidebarMenuButton> */}
        {/* </Link> */}
        <Link className="flex items-center gap-2" to="/style">
          <SidebarMenuButton isActive={pathname === "/style"} size="sm">
            <PenBoxIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Writing Style</span>
          </SidebarMenuButton>
        </Link>
        <Link className="flex items-center gap-2" to="/notes">
          <SidebarMenuButton isActive={pathname.startsWith("/notes")} size="sm">
            <StickyNoteIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Notes</span>
          </SidebarMenuButton>
        </Link>
      </SidebarContent>
      <SidebarFooter className="gap-1.5 space-y-0 pb-12">
        <SidebarMenuButton size="sm" onClick={() => setHelpOpen(true)}>
          <HelpCircleIcon size={16} className="opacity-60" aria-hidden="true" />
          <span>Help</span>
        </SidebarMenuButton>
        <SidebarMenuButton size="sm" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon size={16} className="opacity-60" aria-hidden="true" />
          <span>Settings</span>
        </SidebarMenuButton>

        <small className="pl-3 text-[8px] text-muted-foreground">
          © 2025 Dicto, Inc. v.{version}
        </small>
      </SidebarFooter>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm bg-white border">
          <div className="flex flex-col items-center py-6">
            <p className="mb-6 text-muted-foreground text-sm">Dictation for beginners</p>
            <div className="flex items-center gap-5">
              {sortedKeys.map((key, index) => (
                <div key={key} className="flex items-center gap-5">
                  {index > 0 && <span className="text-gray-800 mx-2">+</span>}
                  <div className="flex min-w-16 items-center justify-center rounded-lg border border-b-3 bg-white border-gray-200 px-3 py-3 shadow-sm">
                    <span className="text-sm text-gray-500">{formatKey(key)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                  tutorialStep === "holding" || tutorialStep === "speaking" || tutorialStep === "done"
                    ? "bg-sky-100 text-sky-600 scale-110"
                    : "bg-gray-100"
                )}>
                  <span className="text-sm">{firstKeySymbol}</span>
                </div>
                <span className={cn(
                  "text-[10px] transition-colors",
                  tutorialStep === "holding" || tutorialStep === "speaking" || tutorialStep === "done"
                    ? "text-sky-600 font-medium"
                    : "text-muted-foreground"
                )}>Hold</span>
              </div>
              <div className={cn(
                "h-px w-6 transition-colors",
                tutorialStep === "speaking" || tutorialStep === "done" ? "bg-sky-300" : "bg-gray-200"
              )} />
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                  tutorialStep === "speaking"
                    ? "bg-sky-100 text-sky-600 scale-110 animate-pulse"
                    : tutorialStep === "done"
                    ? "bg-sky-100 text-sky-600"
                    : "bg-gray-100"
                )}>
                  <svg className={cn(
                    "h-4 w-4 transition-colors",
                    tutorialStep === "speaking" || tutorialStep === "done" ? "text-sky-600" : "text-gray-500"
                  )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <span className={cn(
                  "text-[10px] transition-colors",
                  tutorialStep === "speaking" || tutorialStep === "done"
                    ? "text-sky-600 font-medium"
                    : "text-muted-foreground"
                )}>Speak</span>
              </div>
              <div className={cn(
                "h-px w-6 transition-colors",
                tutorialStep === "done" ? "bg-sky-300" : "bg-gray-200"
              )} />
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                  tutorialStep === "done"
                    ? "bg-green-100 text-green-600 scale-110"
                    : "bg-gray-100"
                )}>
                  <svg className={cn(
                    "h-4 w-4 transition-colors",
                    tutorialStep === "done" ? "text-green-600" : "text-gray-500"
                  )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span className={cn(
                  "text-[10px] transition-colors",
                  tutorialStep === "done"
                    ? "text-green-600 font-medium"
                    : "text-muted-foreground"
                )}>Release</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
