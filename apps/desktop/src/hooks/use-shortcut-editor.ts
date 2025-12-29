import { useState, useCallback, useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
	normalizeKey,
	isModifierKey,
	sortKeys,
} from "@/lib/keyboard-utils";

export type Shortcut = string[];

// Reserved shortcuts that cannot be used
const RESERVED_SHORTCUTS = [
	["Command", "C"],
	["Command", "V"],
	["Command", "X"],
	["Command", "A"],
	["Command", "Z"],
	["Command", "Q"],
	["Command", "W"],
	["Command", "N"],
	["Command", "O"],
	["Command", "S"],
	["Command", "P"],
	["Command", "Tab"],
	// Common app shortcuts
	["Command", "Comma"],
	["Command", "H"],
	["Command", "M"],
];

interface UseShortcutEditorOptions {
	onSave?: (shortcut: Shortcut) => void;
	onCancel?: () => void;
}

export function useShortcutEditor(
	options: UseShortcutEditorOptions = {}
) {
	const { onSave, onCancel } = options;
	const [isEditing, setIsEditing] = useState(false);
	const [currentKeys, setCurrentKeys] = useState<string[]>([]);
	const pressedKeysRef = useRef(new Set<string>());

	const startEditing = useCallback(() => {
		setIsEditing(true);
		setCurrentKeys([]);
		pressedKeysRef.current.clear();
	}, []);

	const saveShortcut = useCallback(() => {
		if (!isEditing || currentKeys.length < 1) return;

		// Check if it's a reserved shortcut
		const sortedKeys = sortKeys(currentKeys);
		const isReserved = RESERVED_SHORTCUTS.some(
			(reserved) =>
				reserved.length === sortedKeys.length &&
				reserved.every(
					(key, index) =>
						key.toLowerCase() === sortedKeys[index].toLowerCase()
				)
		);

		if (isReserved) {
			console.error("This is a reserved shortcut");
			return;
		}

		onSave?.(sortedKeys);
		setIsEditing(false);
		setCurrentKeys([]);
		pressedKeysRef.current.clear();
	}, [isEditing, currentKeys, onSave]);

	const cancelEditing = useCallback(() => {
		setIsEditing(false);
		setCurrentKeys([]);
		pressedKeysRef.current.clear();
		onCancel?.();
	}, [onCancel]);

	// Set a special key directly (for keys that can't be captured via browser)
	const setSpecialKey = useCallback((key: string) => {
		setCurrentKeys([key]);
		pressedKeysRef.current.clear();
		pressedKeysRef.current.add(key);
	}, []);

	// Register key capture for editing state
	useHotkeys(
		"*",
		(e) => {
			if (!isEditing) return;

			e.preventDefault();
			e.stopPropagation();

			const key = normalizeKey(e.code);

			// Update pressed keys
			pressedKeysRef.current.add(key);

			setCurrentKeys(() => {
				const keys = Array.from(pressedKeysRef.current);
				let modifiers = keys.filter(isModifierKey);
				let nonModifiers = keys.filter((k) => !isModifierKey(k));

				// Limit modifiers to 2
				if (modifiers.length > 2) {
					modifiers = modifiers.slice(0, 2);
				}

				// Limit non-modifiers to 2
				if (nonModifiers.length > 2) {
					nonModifiers = nonModifiers.slice(0, 2);
				}

				// Combine modifiers and non-modifiers
				return [...modifiers, ...nonModifiers];
			});
		},
		{
			enabled: isEditing,
			keydown: true,
			enableOnContentEditable: true,
			enableOnFormTags: true,
		},
		[isEditing]
	);

	// Handle key up events
	useHotkeys(
		"*",
		(e) => {
			if (!isEditing) return;
			const key = normalizeKey(e.code);
			pressedKeysRef.current.delete(key);
		},
		{
			enabled: isEditing,
			keyup: true,
			enableOnContentEditable: true,
			enableOnFormTags: true,
		},
		[isEditing]
	);

	// Clean up editing state when component unmounts
	useEffect(() => {
		return () => {
			if (isEditing) {
				cancelEditing();
			}
		};
	}, [isEditing, cancelEditing]);

	return {
		isEditing,
		currentKeys,
		startEditing,
		saveShortcut,
		cancelEditing,
		setSpecialKey,
	};
}
