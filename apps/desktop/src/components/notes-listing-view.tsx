import { Link } from "@tanstack/react-router";
import { Copy, StickyNote, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes } from "@/hooks/use-notes";

interface Note {
	id: string;
	title: string;
	content: string;
	createdAt: Date;
	updatedAt: Date;
}

function formatDateGroup(date: Date): string {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const dateStr = date.toDateString();
	const todayStr = today.toDateString();
	const yesterdayStr = yesterday.toDateString();

	if (dateStr === todayStr) {
		return "today";
	}
	if (dateStr === yesterdayStr) {
		return "yesterday";
	}
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function formatTimestamp(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

interface GroupedNote {
	id: string;
	title: string;
	content: string;
	date: Date;
	timestamp: string;
}

function groupNotesByDate(notes: Note[]): Record<string, GroupedNote[]> {
	const grouped: Record<string, GroupedNote[]> = {};

	for (const note of notes) {
		const dateGroup = formatDateGroup(note.createdAt);
		const timestamp = formatTimestamp(note.createdAt);

		if (!grouped[dateGroup]) {
			grouped[dateGroup] = [];
		}

		grouped[dateGroup].push({
			id: note.id,
			title: note.title,
			content: note.content,
			date: note.createdAt,
			timestamp,
		});
	}

	return grouped;
}

interface AnalyticsProps {
	totalNotes: number;
	totalWords: number;
}

function Analytics({ totalNotes, totalWords }: AnalyticsProps) {
	const avgWords = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0;

	const stats = [
		{ label: "Notes", value: totalNotes },
		{ label: "Total Words", value: totalWords.toLocaleString() },
		{ label: "Avg. Words", value: avgWords },
	];

	return (
		<div className="mb-6 flex gap-8 pb-4">
			{stats.map(({ label, value }) => (
				<div key={label} className="flex items-baseline gap-2">
					<span className="font-normal text-2xl tabular-nums">{value}</span>
					<span className="text-muted-foreground text-xs">{label}</span>
				</div>
			))}
		</div>
	);
}

function EmptyState() {
	return (
		<Empty className="border-dashed">
			<EmptyContent>
				<EmptyHeader>
					<EmptyMedia variant="icon" className="border">
						<StickyNote className="h-6 w-6" />
					</EmptyMedia>
					<EmptyTitle>No notes yet</EmptyTitle>
					<EmptyDescription>
						Start creating notes to see them appear here.
					</EmptyDescription>
				</EmptyHeader>
			</EmptyContent>
		</Empty>
	);
}

interface NoteItemProps {
	note: GroupedNote;
	onDelete: (id: string) => void;
}

function NoteItem({ note, onDelete }: NoteItemProps) {
	const handleCopy = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		navigator.clipboard.writeText(note.content);
		toast.success("Copied to clipboard");
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onDelete(note.id);
		toast.success("Note deleted");
	};

	return (
		<Link
			to="/notes/$noteId"
			params={{ noteId: note.id }}
			className="group/item flex items-start gap-4 py-4 transition-colors"
		>
			<div className="min-w-0 flex-1 space-y-2">
				<p className="line-clamp-2 text-foreground text-sm leading-relaxed">
					{note.title}
				</p>
				<div className="flex items-center gap-2">
					<span className="font-medium text-muted-foreground text-xs">
						{note.timestamp}
					</span>
					{note.content && (
						<>
							<span>•</span>
							<span className="line-clamp-1 font-medium text-muted-foreground text-xs">
								{note.content.replace(/<[^>]*>/g, "").slice(0, 50)}
							</span>
						</>
					)}
				</div>
			</div>
			<ButtonGroup
				orientation="horizontal"
				className="opacity-0 transition-opacity group-hover/item:opacity-100"
			>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={handleCopy}
					className="h-8 w-8 p-0"
				>
					<Copy className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={handleDelete}
					className="h-8 w-8 p-0"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</ButtonGroup>
		</Link>
	);
}

export function NotesListingView() {
	const { notes, loading, remove } = useNotes();

	const groupedNotes = useMemo(() => groupNotesByDate(notes), [notes]);

	const totalWords = useMemo(() => {
		return notes.reduce((sum, note) => {
			const plainText = note.content.replace(/<[^>]*>/g, "");
			return sum + plainText.split(/\s+/).filter((w) => w.length > 0).length;
		}, 0);
	}, [notes]);

	const isEmpty = notes.length === 0;

	if (loading && notes.length === 0) {
		return (
			<>
				<div className="mb-6 grid grid-cols-3 gap-4">
					<div className="space-y-1">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-8 w-12" />
					</div>
				</div>
				<div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
					<div>
						<div className="sticky top-0 mb-3 flex items-center gap-2 py-2">
							<Skeleton className="h-3 w-24" />
						</div>
						<div className="space-y-3">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="flex items-start gap-4 rounded-lg px-4 py-2"
								>
									<div className="min-w-0 flex-1">
										<div className="mb-2 flex items-center gap-2">
											<Skeleton className="h-3 w-16" />
											<Skeleton className="h-4 w-20 rounded-full" />
										</div>
										<div className="space-y-1">
											<Skeleton className="h-4 w-full" />
											<Skeleton className="h-4 w-4/5" />
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			{isEmpty ? (
				<EmptyState />
			) : (
				<>
					<Analytics totalNotes={notes.length} totalWords={totalWords} />
					<div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
						{Object.entries(groupedNotes).map(([dateGroup, items]) => (
							<div key={dateGroup}>
								<div className="sticky top-0 mb-3 flex items-center gap-2 bg-sidebar py-2">
									<small className="font-normal text-muted-foreground text-xs capitalize tracking-wider">
										{dateGroup}
									</small>
								</div>
								<div className="space-y-3">
									{items.map((note) => (
										<div
											key={note.id}
											className="group/item flex items-center gap-3"
										>
											<div className="flex-1">
												<NoteItem note={note} onDelete={remove} />
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</>
	);
}
