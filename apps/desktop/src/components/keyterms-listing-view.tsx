import { BookText, Check, Plus, Search, Trash2, X } from "lucide-react";
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
import type { Keyterm, KeytermCategory } from "@/hooks/use-keyterms";

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

interface KeytermsListingViewProps {
	keyterms: Keyterm[];
	loading: boolean;
	error: string | null;
	update: (id: string, text: string, category: KeytermCategory) => Promise<void>;
	remove: (id: string) => Promise<void>;
	onAddClick: () => void;
}

export function KeytermsListingView({
	keyterms,
	update,
	remove,
	onAddClick,
}: KeytermsListingViewProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingText, setEditingText] = useState("");
	const [editingCategory, setEditingCategory] = useState("");

	// Filters
	const [searchQuery, setSearchQuery] = useState("");
	const [filterCategory, setFilterCategory] = useState("all");

	const filteredKeyterms = keyterms.filter((term) => {
		const matchesSearch = term.text
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesCategory =
			filterCategory === "all" || term.category === filterCategory;
		return matchesSearch && matchesCategory;
	});

	const handleDeleteTerm = (id: string) => {
		remove(id);
	};

	const handleStartEdit = (term: Keyterm) => {
		setEditingId(term.id);
		setEditingText(term.text);
		setEditingCategory(term.category);
	};

	const handleSaveEdit = () => {
		if (!editingText.trim() || !editingId) return;
		update(editingId, editingText.trim(), editingCategory as KeytermCategory);
		setEditingId(null);
		setEditingText("");
		setEditingCategory("");
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setEditingText("");
		setEditingCategory("");
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

	if (keyterms.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<BookText />
					</EmptyMedia>
					<EmptyTitle>No words yet</EmptyTitle>
					<EmptyDescription>
						Add technical terms, proper nouns, and acronyms to improve
						transcription accuracy.
					</EmptyDescription>
				</EmptyHeader>
				<Button variant="outline" size="sm" onClick={onAddClick}>
					<Plus className="size-4" />
					Add your first word
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
						placeholder="Search keyterms..."
					/>
				</div>

				{/* Category Tabs */}
				<Tabs
					value={filterCategory}
					onValueChange={(value) => setFilterCategory(value as string)}
				>
					<TabsList variant="underline">
						{CATEGORIES.map((category) => {
							const count = keyterms.filter(
								(t) =>
									category.value === "all" || t.category === category.value,
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
					{filteredKeyterms.length}
				</span>
				<span className="text-muted-foreground text-sm">
					{filteredKeyterms.length === 1 ? "Word" : "Words"}
					{(searchQuery || filterCategory !== "all") && (
						<span className="ml-1">(of {keyterms.length} total)</span>
					)}
				</span>
			</div>

			{/* Words List */}
			<div className="flex flex-col">
				{filteredKeyterms.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground text-sm">
						No keyterms match your filters
					</div>
				) : (
					filteredKeyterms.map((term) =>
						editingId === term.id ? (
							<div
								key={term.id}
								className="flex items-center gap-3 border-border/50 border-b py-3.5"
							>
								<Input
									value={editingText}
									onChange={(e) => setEditingText(e.target.value)}
									onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
									placeholder="Word or term"
									autoFocus
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
								key={term.id}
								className="-mx-3 group flex items-center justify-between rounded-md px-3 py-3.5 transition-colors hover:bg-muted/50"
							>
								<button
									type="button"
									className="flex flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
									onClick={() => handleStartEdit(term)}
								>
									<span className="text-[15px] text-foreground">
										{term.text}
									</span>
									<span className="text-muted-foreground text-xs">
										{getCategoryLabel(term.category)}
									</span>
								</button>
								<Button
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
									onClick={() => handleDeleteTerm(term.id)}
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
