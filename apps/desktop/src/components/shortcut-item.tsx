import { X } from "lucide-react";
import { formatKey, sortKeys } from "@/lib/keyboard-utils";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Special keys that can't be captured via browser keyboard events
const SPECIAL_KEYS = [
	{ value: "Fn", label: "Fn (Function)" },
	{ value: "CapsLock", label: "⇪ CapsLock" },
];

interface ShortcutItemProps {
	shortcut: string[];
	isEditing: boolean;
	currentKeys: string[];
	onEdit: () => void;
	onSave: () => void;
	onCancel: () => void;
	onSetSpecialKey?: (key: string) => void;
}

export function ShortcutItem({
	shortcut,
	isEditing,
	currentKeys,
	onEdit,
	onSave,
	onCancel,
	onSetSpecialKey,
}: ShortcutItemProps) {
	const renderKeys = (keys: string[]) => {
		const sortedKeys = sortKeys(keys);
		return sortedKeys.map((key, index) => (
			<kbd
				key={index}
				className={cn(
					"inline-flex items-center justify-center px-2 py-1",
					"text-xs font-semibold rounded shadow-sm",
					" border border-border text-foreground border-b-2",
					"min-w-6 bg-white"
				)}
			>
				{formatKey(key)}
			</kbd>
		));
	};

	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				{isEditing ? (
					<>
						<div className="flex gap-1 min-w-20">
							{currentKeys.length > 0 ? (
								renderKeys(currentKeys)
							) : (
								<span className="text-muted-foreground text-sm italic">
									Press keys...
								</span>
							)}
						</div>
						<div className="flex gap-2 items-center">
							<Select
								onValueChange={(value) => onSetSpecialKey?.(value)}
							>
								<SelectTrigger className="w-[130px] h-8 text-xs">
									<SelectValue placeholder="Special key" />
								</SelectTrigger>
								<SelectContent>
									{SPECIAL_KEYS.map((key) => (
										<SelectItem key={key.value} value={key.value}>
											{key.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								size="sm"
								onClick={onSave}
								disabled={currentKeys.length < 1}
							>
								Save
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={onCancel}
								className="p-1.5"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</>
				) : (
					<>
						<div className="flex gap-1">{renderKeys(shortcut)}</div>
						<Button variant="ghost" size="sm" onClick={onEdit}>
							Edit
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
