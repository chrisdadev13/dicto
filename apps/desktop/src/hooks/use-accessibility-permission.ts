import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	checkAccessibilityPermission,
	requestAccessibilityPermission,
} from "tauri-plugin-macos-permissions-api";

export function useAccessibilityPermission() {
	const [isLoading, setIsLoading] = useState(false);
	const [hasPermission, setHasPermission] = useState(false);

	useEffect(() => {
		const checkPermission = async () => {
			// TODO: Support other platforms (windows, linux)
			try {
				const hasPermission = await checkAccessibilityPermission();
				setHasPermission(hasPermission);
			} catch {
				setHasPermission(false);
			}
		};
		checkPermission();
	}, []);

	const openSystemSettings = async () => {
		// TODO: Support other platforms (windows, linux)
		try {
			const url: string =
				"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
			const message: string =
				"Opening System Settings. Please enable accessibility access for Dicto and restart the app.";

			await openUrl(url);
			toast.info(message);
		} catch (error) {
			console.error(error);
			toast.error("Could not open system settings. Please open them manually.");
		}
	};

	const requestPermission = async () => {
		setIsLoading(true);
		// TODO: Support other platforms (windows, linux)
		try {
			const granted = await requestAccessibilityPermission();
			if (granted) {
				setHasPermission(true);
				toast.success("Accessibility access granted!");
			} else {
				await openSystemSettings();
			}
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "NotAllowedError") {
					// Permission denied - open system settings
					await openSystemSettings();
				} else {
					toast.error(
						"Failed to request accessibility permission. Please try again.",
					);
				}
			} else {
				// TODO: Support other platforms (windows, linux)
				await openSystemSettings();
			}
		} finally {
			setIsLoading(false);
		}
	};

	return {
		hasPermission,
		isLoading,
		requestPermission,
		openSystemSettings,
	};
}
