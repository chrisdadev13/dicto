import { useState, useEffect } from "react";
import { commands } from "@/bindings";
import { shortcutStringToKeys } from "@/lib/keyboard-utils";

/**
 * Hook to fetch and return the current global shortcut keys
 */
export function useCurrentShortcut() {
	const [shortcut, setShortcut] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchShortcut = async () => {
			try {
				const res = await commands.getCurrentShortcut();
				if (res.status === "ok") {
					setShortcut(shortcutStringToKeys(res.data));
				}
			} catch (err) {
				console.error("Failed to fetch shortcut:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchShortcut();
	}, []);

	return { shortcut, loading };
}
