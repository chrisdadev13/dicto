import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	checkMicrophonePermission,
	requestMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";

export function useMicrophonePermission() {
	const [isLoading, setIsLoading] = useState(false);
	const [hasPermission, setHasPermission] = useState(false);

	useEffect(() => {
		const checkPermission = async () => {
			// TODO: Support other platforms (windows, linux)
			try {
				const hasPermission = await checkMicrophonePermission();
				console.log(hasPermission);
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
				"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
			const message: string =
				"Opening System Settings. Please enable microphone access for Dicto and restart the app.";

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
			const granted = await requestMicrophonePermission();
			if (granted) {
				setHasPermission(true);
				toast.success("Microphone access granted!");
			} else {
				await openSystemSettings();
			}
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "NotAllowedError") {
					// Permission denied - open system settings
					await openSystemSettings();
				} else if (error.name === "NotFoundError") {
					toast.error(
						"No microphone found. Please connect a microphone and try again.",
					);
				} else {
					toast.error("Failed to access microphone. Please try again.");
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
