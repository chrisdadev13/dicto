import { Button } from "@/components/ui/button";
import { useNotes } from "@/hooks/use-notes";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NotesListingView } from "@/components/notes-listing-view";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/_sidebar/notes")({
	component: RouteComponent,
});

function RouteComponent() {
	const { create } = useNotes();
	const navigate = useNavigate();

	const handleNewNote = async () => {
		const noteId = await create({
			title: "Untitled Note",
			content: "",
		});

		console.log(noteId);
		navigate({ to: "/notes/$noteId", params: { noteId } });
	};
	return (
		<Shell title="Notes" subtitle="Your voice-created notes" headerActions={
      <Button size="sm" onClick={handleNewNote}>New Note</Button>
    }>
			<NotesListingView />
		</Shell>
	);
}
