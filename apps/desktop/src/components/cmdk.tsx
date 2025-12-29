import { useNavigate } from "@tanstack/react-router";
import {
	BookText,
	Home,
	Search,
	StickyNoteIcon,
	Type,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";

export function Cmdk() {
	const [open, setOpen] = React.useState(false);
	const navigate = useNavigate();

	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	const handleNavigate = (to: string) => {
		navigate({ to });
		setOpen(false);
	};

	return (
		<>
			<Button
				size="sm"
				variant="outline"
				className="mx-72 flex flex-1 items-center justify-center gap-2 rounded-sm border font-normal text-muted-foreground text-xs"
				onClick={() => setOpen(true)}
			>
				<Search size={16} className="mb-px opacity-60" />
				Search...
			</Button>
			<CommandDialog open={open} onOpenChange={setOpen}>
				<CommandInput placeholder="Type a command or search..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Navigation">
						<CommandItem onSelect={() => handleNavigate("/home")}>
							<Home className="mr-2 h-4 w-4" />
							<span>Home</span>
						</CommandItem>
						<CommandItem onSelect={() => handleNavigate("/keyterms")}>
							<BookText className="mr-2 h-4 w-4" />
							<span>Dictionary</span>
						</CommandItem>

						<CommandItem onSelect={() => handleNavigate("/style")}>
							<Type className="mr-2 h-4 w-4" />
							<span>Writing Style</span>
						</CommandItem>
						<CommandItem onSelect={() => handleNavigate("/notes")}>
							<StickyNoteIcon className="mr-2 h-4 w-4" />
							<span>Notes</span>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}
