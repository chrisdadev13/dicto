import {
	ArrowRight,
	Check,
	FileText,
	Plus,
	Search,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import type { Shortcut, ShortcutCategory } from "@/hooks/use-shortcuts";

const CATEGORIES = [
	{ value: "all", label: "All Categories", description: "Apply everywhere" },
	{
		value: "Personal",
		label: "Personal",
		description: "iMessage, WhatsApp, Telegram",
	},
	{ value: "Work", label: "Work", description: "Slack, Teams, Discord" },
	{ value: "Email", label: "Email", description: "Mail, Gmail, Outlook" },
	{ value: "Notes", label: "Notes", description: "Notes, Notion, Obsidian" },
] as const;

interface ShortcutsListingViewProps {
	shortcuts: Shortcut[];
	loading: boolean;
	error: string | null;
	update: (
		id: string,
		trigger: string,
		replacement: string,
		category: ShortcutCategory,
	) => Promise<void>;
	remove: (id: string) => Promise<void>;
	onAddClick: () => void;
}

export function ShortcutsListingView({
	shortcuts,
	update,
	remove,
	onAddClick,
}: ShortcutsListingViewProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTrigger, setEditingTrigger] = useState("");
	const [editingReplacement, setEditingReplacement] = useState("");
	const [editingCategory, setEditingCategory] = useState("");

	// Filters
	const [searchQuery, setSearchQuery] = useState("");
	const [filterCategory, setFilterCategory] = useState("all");

	const filteredShortcuts = shortcuts.filter((shortcut) => {
		const matchesSearch =
			shortcut.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
			shortcut.replacement.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesCategory =
			filterCategory === "all" || shortcut.category === filterCategory;
		return matchesSearch && matchesCategory;
	});

	const handleDeleteShortcut = (id: string) => {
		remove(id);
	};

	const handleStartEdit = (shortcut: Shortcut) => {
		setEditingId(shortcut.id);
		setEditingTrigger(shortcut.trigger);
		setEditingReplacement(shortcut.replacement);
		setEditingCategory(shortcut.category);
	};

	const handleSaveEdit = () => {
		if (!editingTrigger.trim() || !editingReplacement.trim() || !editingId)
			return;
		update(
			editingId,
			editingTrigger.trim(),
			editingReplacement.trim(),
			editingCategory as ShortcutCategory,
		);
		setEditingId(null);
		setEditingTrigger("");
		setEditingReplacement("");
		setEditingCategory("");
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setEditingTrigger("");
		setEditingReplacement("");
	};

	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement>,
		action: () => void,
	) => {
		if (e.key === "Enter") {
			e.preventDefault();
			action();
		}
		if (e.key === "Escape") {
			e.preventDefault();
			handleCancelEdit();
		}
	};

	const getCategoryLabel = (value: string) => {
		return CATEGORIES.find((c) => c.value === value)?.label ?? "All Categories";
	};

	if (shortcuts.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileText />
					</EmptyMedia>
					<EmptyTitle>No shortcuts yet</EmptyTitle>
					<EmptyDescription>
						Create text shortcuts that expand into longer phrases to speed up
						your typing.
					</EmptyDescription>
				</EmptyHeader>
				<Button variant="outline" size="sm" onClick={onAddClick}>
					<Plus className="size-4" />
					Add your first shortcut
				</Button>
			</Empty>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Filters */}
			<div className="flex flex-col gap-4">
				{/* Search */}
				<div className="relative">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search shortcuts..."
						className="pl-9"
					/>
				</div>

				{/* Category Tabs */}
				<Tabs
					value={filterCategory}
					onValueChange={(value) => setFilterCategory(value as string)}
				>
					<TabsList variant="underline">
						{CATEGORIES.map((category) => {
							const count = shortcuts.filter(
								(s) =>
									category.value === "all" || s.category === category.value,
							).length;
							return (
								<TabsTab key={category.value} value={category.value}>
									{category.label}
									<span className="text-muted-foreground/70">{count}</span>
								</TabsTab>
							);
						})}
					</TabsList>
				</Tabs>
			</div>

			{/* Stats */}
			<div className="flex items-baseline gap-2">
				<span className="font-light text-3xl tabular-nums">
					{filteredShortcuts.length}
				</span>
				<span className="text-muted-foreground text-sm">
					{filteredShortcuts.length === 1 ? "Shortcut" : "Shortcuts"}
					{(searchQuery || filterCategory !== "all") && (
						<span className="ml-1">(of {shortcuts.length} total)</span>
					)}
				</span>
			</div>

			{/* Snippets List */}
			<div className="flex flex-col">
				{filteredShortcuts.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground text-sm">
						No shortcuts match your filters
					</div>
				) : (
					filteredShortcuts.map((shortcut) =>
						editingId === shortcut.id ? (
							<div
								key={shortcut.id}
								className="flex items-center gap-3 border-border/50 border-b py-4"
							>
								<Input
									value={editingTrigger}
									onChange={(e) => setEditingTrigger(e.target.value)}
									placeholder="Trigger"
									autoFocus
									className="w-24 shrink-0"
								/>
								<ArrowRight className="size-4 shrink-0 text-muted-foreground" />
								<Input
									value={editingReplacement}
									onChange={(e) => setEditingReplacement(e.target.value)}
									onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
									placeholder="Replacement"
									className="flex-1"
								/>
								<div className="flex gap-1">
									<Button
										variant="default"
										size="icon-sm"
										onClick={handleSaveEdit}
									>
										<Check className="size-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={handleCancelEdit}
									>
										<X className="size-4" />
									</Button>
								</div>
							</div>
						) : (
							<div
								key={shortcut.id}
								className="-mx-3 group flex items-center justify-between rounded-md px-3 py-4 transition-colors hover:bg-muted/50"
							>
								<button
									type="button"
									className="flex flex-1 cursor-pointer items-center gap-3 text-left"
									onClick={() => handleStartEdit(shortcut)}
								>
									<span className="w-20 shrink-0 font-medium text-[15px] text-foreground">
										{shortcut.trigger}
									</span>
									<ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-muted-foreground text-sm">
											{shortcut.replacement}
										</span>
										<span className="text-muted-foreground/70 text-xs">
											{getCategoryLabel(shortcut.category)}
										</span>
									</div>
								</button>
								<Button
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
									onClick={() => handleDeleteShortcut(shortcut.id)}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						),
					)
				)}
			</div>
		</div>
	);
}

export { CATEGORIES };
