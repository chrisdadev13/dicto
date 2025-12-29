import { Power, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SettingsDropdown() {
	return (
		<div className="absolute top-6 right-6 z-50">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm">
						<Settings strokeWidth={1.5} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="mr-8">
					<p className="p-1 text-muted-foreground text-xs"> Dicto v.1.0.0</p>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" className="text-xs">
						<Power />
						Quit Dicto
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
