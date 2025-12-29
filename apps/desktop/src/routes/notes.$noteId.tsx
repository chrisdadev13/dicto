import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Cmdk } from "@/components/cmdk";
import { NoteEditor } from "@/components/note-editor";
import { TitleBar } from "@/components/title-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes } from "@/hooks/use-notes";

export const Route = createFileRoute("/notes/$noteId")({
	component: RouteComponent,
});

interface Note {
	id: string;
	title: string;
	content: string;
	createdAt: Date;
	updatedAt: Date;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function RouteComponent() {
	const { noteId } = Route.useParams();
	const { getById, remove, update, create } = useNotes();
	const [note, setNote] = useState<Note | null>(null);
	const [loading, setLoading] = useState(true);
	const [title, setTitle] = useState("");
	const navigate = useNavigate();
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const fetchNote = async () => {
			setLoading(true);
			const result = await getById(noteId);
			setNote(result);
			if (result) {
				setTitle(result.title);
			}
			setLoading(false);
		};
		fetchNote();
	}, [noteId, getById]);

	const handleNewNote = async () => {
		const newNoteId = await create({
			title: "Untitled Note",
			content: "",
		});
		navigate({ to: "/notes/$noteId", params: { noteId: newNoteId } });
	};

	const handleContentChange = useCallback(
		(content: string) => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			saveTimeoutRef.current = setTimeout(() => {
				update(noteId, { content });
			}, 500);
		},
		[noteId, update],
	);

	const handleTitleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newTitle = e.target.value;
			setTitle(newTitle);

			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			saveTimeoutRef.current = setTimeout(() => {
				update(noteId, { title: newTitle });
			}, 500);
		},
		[noteId, update],
	);

	const handleCopy = useCallback(() => {
		if (note) {
			navigator.clipboard.writeText(note.content);
			toast.success("Copied to clipboard");
		}
	}, [note]);

	const handleDelete = useCallback(async () => {
		if (note) {
			await remove(note.id);
			toast.success("Note deleted");
			navigate({ to: "/notes" });
		}
	}, [note, remove, navigate]);

	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	if (loading) {
		return (
			<div className="h-screen overflow-hidden bg-background">
				<TitleBar className="flex w-full items-center justify-between bg-background pt-2">
					<div
						className="flex w-full items-center justify-between pb-2"
						data-tauri-drag-region
					>
						<Skeleton className="h-8 w-8" />
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-8 w-20" />
					</div>
				</TitleBar>
				<div className="mx-2 mt-10.5 mb-1 h-[calc(100vh-50px)] overflow-y-auto rounded-lg border bg-white">
					<div className="mx-auto max-w-2xl px-6 py-8">
						<div className="mb-8">
							<Skeleton className="mb-2 h-8 w-3/4" />
							<Skeleton className="h-4 w-1/2" />
						</div>
						<div className="space-y-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!note) {
		return (
			<div className="h-screen overflow-hidden bg-background">
				<TitleBar className="flex w-full items-center justify-between bg-background pt-2">
					<div
						className="flex w-full items-center justify-between pb-2"
						data-tauri-drag-region
					>
						<Link to="/notes">
							<Button size="icon-sm" variant="ghost">
								<ArrowLeft className="text-gray-400" />
							</Button>
						</Link>
						<Cmdk />
						<Button
							size="sm"
							variant="secondary"
							className="bg-[#E5E6E9] hover:bg-[#E5E6E9]/60"
							onClick={handleNewNote}
						>
							New note
						</Button>
					</div>
				</TitleBar>
				<div className="mx-2 mt-10.5 mb-1 flex h-[calc(100vh-50px)] items-center justify-center overflow-y-auto rounded-lg border bg-white">
					<div className="text-center">
						<h1 className="font-semibold text-foreground text-xl">
							Note not found
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							The note you're looking for doesn't exist.
						</p>
						<Link to="/notes" className="mt-4 inline-block">
							<Button variant="outline" size="sm">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back to Notes
							</Button>
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen overflow-hidden bg-sidebar">
			<TitleBar className="flex w-full items-center justify-between bg-sidebar pt-2">
				<div
					className="flex w-full items-center justify-between pb-2"
					data-tauri-drag-region
				>
					<Link to="/notes">
						<Button size="icon-sm" variant="ghost">
							<ArrowLeft className="text-gray-400" />
						</Button>
					</Link>
					<Cmdk />
					<Button
						size="sm"
						variant="secondary"
						className="bg-[#E5E6E9] hover:bg-[#E5E6E9]/60"
						onClick={handleNewNote}
					>
						New note
					</Button>
				</div>
			</TitleBar>
			<div
				className="mx-2 mt-10.5 mb-1 h-[calc(100vh-50px)] overflow-y-auto rounded-lg border bg-white"
				style={{ overscrollBehavior: "contain" }}
			>
				<div className="mx-auto max-w-2xl px-6 py-8">
					<div className="mb-6 flex items-center justify-end gap-2">
						<Button variant="outline" size="icon-sm" onClick={handleCopy}>
							<Copy className="h-4 w-4" />
						</Button>
						<Button variant="outline" size="icon-sm" onClick={handleDelete}>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
					<div className="mb-8 text-start">
						<input
							type="text"
							value={title}
							onChange={handleTitleChange}
							className="w-full border-none bg-transparent font-semibold text-2xl text-foreground outline-none placeholder:text-muted-foreground"
							placeholder="Note title..."
						/>
						<p className="mt-2 text-muted-foreground text-sm">
							{formatDate(note.createdAt)}
						</p>
					</div>
					<div className="mt-6">
						<NoteEditor content={note.content} onChange={handleContentChange} />
					</div>
				</div>
			</div>
		</div>
	);
}
