/**
 * Normalize a keyboard event code to a consistent key name
 */
export function normalizeKey(code: string): string {
	// Map event codes to readable key names
	const keyMap: Record<string, string> = {
		// Modifiers
		MetaLeft: "Command",
		MetaRight: "Command",
		ControlLeft: "Control",
		ControlRight: "Control",
		AltLeft: "Alt",
		AltRight: "Alt",
		ShiftLeft: "Shift",
		ShiftRight: "Shift",

		// Special keys
		Space: "Space",
		Enter: "Enter",
		Escape: "Escape",
		Tab: "Tab",
		Backspace: "Backspace",
		Delete: "Delete",
		ArrowUp: "ArrowUp",
		ArrowDown: "ArrowDown",
		ArrowLeft: "ArrowLeft",
		ArrowRight: "ArrowRight",
		Home: "Home",
		End: "End",
		PageUp: "PageUp",
		PageDown: "PageDown",

		// Function keys
		F1: "F1",
		F2: "F2",
		F3: "F3",
		F4: "F4",
		F5: "F5",
		F6: "F6",
		F7: "F7",
		F8: "F8",
		F9: "F9",
		F10: "F10",
		F11: "F11",
		F12: "F12",
	};

	// Check for direct mapping
	if (keyMap[code]) {
		return keyMap[code];
	}

	// Handle letter keys (KeyA -> A)
	if (code.startsWith("Key")) {
		return code.replace("Key", "");
	}

	// Handle digit keys (Digit1 -> 1)
	if (code.startsWith("Digit")) {
		return code.replace("Digit", "");
	}

	// Handle numpad keys (Numpad1 -> Numpad1)
	if (code.startsWith("Numpad")) {
		return code;
	}

	// Default: return the code as-is
	return code;
}

/**
 * Format a key name for display with platform-specific symbols
 */
export function formatKey(key: string): string {
	const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

	if (isMac) {
		const macSymbols: Record<string, string> = {
			Command: "⌘",
			Control: "⌃",
			Alt: "⌥",
			Shift: "⇧",
			Enter: "↵",
			Escape: "⎋",
			Tab: "⇥",
			Backspace: "⌫",
			Delete: "⌦",
			ArrowUp: "↑",
			ArrowDown: "↓",
			ArrowLeft: "←",
			ArrowRight: "→",
			Space: "Space",
			Fn: "fn",
			CapsLock: "⇪",
		};
		return macSymbols[key] || key;
	}

	// Windows/Linux display
	const symbols: Record<string, string> = {
		Command: "Win",
		Control: "Ctrl",
		Alt: "Alt",
		Shift: "Shift",
		Enter: "Enter",
		Escape: "Esc",
		Space: "Space",
		Fn: "Fn",
		CapsLock: "CapsLock",
	};
	return symbols[key] || key;
}

/**
 * Check if a key is a modifier key
 */
export function isModifierKey(key: string): boolean {
	return ["Command", "Control", "Alt", "Shift"].includes(key);
}

/**
 * Sort keys with modifiers first in a consistent order
 */
export function sortKeys(keys: string[]): string[] {
	const modifierOrder = ["Control", "Alt", "Shift", "Command"];

	return [...keys].sort((a, b) => {
		const aIndex = modifierOrder.indexOf(a);
		const bIndex = modifierOrder.indexOf(b);

		// Both are modifiers - sort by order
		if (aIndex !== -1 && bIndex !== -1) {
			return aIndex - bIndex;
		}

		// Only a is modifier - a comes first
		if (aIndex !== -1) {
			return -1;
		}

		// Only b is modifier - b comes first
		if (bIndex !== -1) {
			return 1;
		}

		// Neither is modifier - alphabetical
		return a.localeCompare(b);
	});
}

/**
 * Convert keys array to a shortcut string for Tauri
 * Example: ["Command", "Shift", "Space"] -> "command+shift+space"
 */
export function keysToShortcutString(keys: string[]): string {
	const sortedKeys = sortKeys(keys);
	return sortedKeys.map((key) => key.toLowerCase()).join("+");
}

/**
 * Parse a shortcut string back to keys array
 * Example: "command+shift+space" -> ["Command", "Shift", "Space"]
 */
export function shortcutStringToKeys(shortcut: string): string[] {
	if (!shortcut) return [];

	const keyMap: Record<string, string> = {
		command: "Command",
		control: "Control",
		ctrl: "Control",
		alt: "Alt",
		option: "Alt",
		shift: "Shift",
		space: "Space",
		enter: "Enter",
		escape: "Escape",
		tab: "Tab",
		backspace: "Backspace",
		delete: "Delete",
		arrowup: "ArrowUp",
		arrowdown: "ArrowDown",
		arrowleft: "ArrowLeft",
		arrowright: "ArrowRight",
		fn: "Fn",
		function: "Fn",
		capslock: "CapsLock",
		caps: "CapsLock",
	};

	return shortcut.split("+").map((key) => {
		const normalized = key.toLowerCase().trim();
		// Check if it's a known key
		if (keyMap[normalized]) {
			return keyMap[normalized];
		}
		// Single letter - uppercase it
		if (normalized.length === 1) {
			return normalized.toUpperCase();
		}
		// Otherwise capitalize first letter
		return normalized.charAt(0).toUpperCase() + normalized.slice(1);
	});
}
