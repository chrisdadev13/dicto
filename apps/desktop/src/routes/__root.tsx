import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SettingsDialog } from "@/components/settings-dialog";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "sonner";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	const navigate = useNavigate();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const { setSetting, settings } = useSettings();

	// Use refs to always access latest settings in event handlers
	const settingsRef = useRef(settings);
	const setSettingRef = useRef(setSetting);

	// Update refs when settings change
	useEffect(() => {
		settingsRef.current = settings;
		setSettingRef.current = setSetting;
	}, [settings, setSetting]);

	// Emit settings-changed event when languages or autoDetect change
	const prevSettingsRef = useRef({ languages: settings.languages, autoDetect: settings.autoDetectLanguage });
	useEffect(() => {
		const hasLanguagesChanged =
			JSON.stringify(prevSettingsRef.current.languages) !== JSON.stringify(settings.languages);
		const hasAutoDetectChanged =
			prevSettingsRef.current.autoDetect !== settings.autoDetectLanguage;

		if (hasLanguagesChanged || hasAutoDetectChanged) {
			console.log("Settings changed, emitting event to update tray");
			emit("settings-changed");
			prevSettingsRef.current = {
				languages: settings.languages,
				autoDetect: settings.autoDetectLanguage
			};
		}
	}, [settings.languages, settings.autoDetectLanguage]);

	useEffect(() => {
		const unlistenPromises = [
			listen("navigate-transcriptions", () => {
				console.log("Navigating to transcriptions (home)");
				navigate({ to: "/home" });
			}),
			listen("navigate-notes", () => {
				console.log("Navigating to notes");
				navigate({ to: "/notes" });
			}),
			listen("navigate-keyterms", () => {
				console.log("Navigating to keyterms");
				navigate({ to: "/keyterms" });
			}),
			listen("navigate-writing-styles", () => {
				console.log("Navigating to writing styles");
				navigate({ to: "/style" });
			}),
			listen("open-settings", () => {
				console.log("Opening settings");
				setSettingsOpen(true);
			}),
			listen("open-docs", () => {
				console.log("Opening documentation");
				// Open documentation URL when available
			}),
			listen("open-report-issue", () => {
				console.log("Opening report issue");
				openUrl("https://github.com/usedicto/dicto/issues");
			}),
			// Tray events
			listen("open-add-keyterm", () => {
				console.log("Opening add keyterm");
				navigate({ to: "/keyterms" });
				toast.success("Opening Dictionary to add new term");
			}),
			listen<string>("toggle-language", async (event) => {
				console.log("Toggling language:", event.payload);
				const lang = event.payload;

				// Get fresh settings value from ref
				const currentLanguages = settingsRef.current.languages;
				const isRemoving = currentLanguages.includes(lang);
				const newLanguages = isRemoving
					? currentLanguages.filter(l => l !== lang)
					: [...currentLanguages, lang];

				if (newLanguages.length > 0) {
					await setSettingRef.current("languages", newLanguages);
					await setSettingRef.current("autoDetectLanguage", false);
					await emit("settings-changed");
					toast.success(`Language ${isRemoving ? 'removed' : 'added'}: ${lang}`);
				} else {
					toast.error("At least one language must be selected");
				}
			}),
			listen("toggle-auto-detect-language", async () => {
				console.log("Toggling auto-detect language");
				const newValue = !settingsRef.current.autoDetectLanguage;
				await setSettingRef.current("autoDetectLanguage", newValue);
				await emit("settings-changed");
				toast.success(newValue ? "Auto-detect enabled" : "Auto-detect disabled");
			}),
		];

		return () => {
			Promise.all(unlistenPromises).then((unlisteners) => {
				unlisteners.forEach((unlisten) => unlisten());
			});
		};
	}, [navigate]);

	return (
		<div className="flex h-screen w-full flex-col">
			<div className="flex-1 overflow-hidden bg-background">
				<Outlet />
				<TanStackRouterDevtools position="bottom-right" />
			</div>
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
		</div>
	);
}
