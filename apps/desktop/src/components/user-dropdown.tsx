import { LogInIcon, LogOutIcon } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { EmailSignIn } from "@/components/email-signin";
import { DictoLogo } from "@/components/dicto-logo";

export function UserDropdown() {
	const session = authClient.useSession();
	const [showAuthDialog, setShowAuthDialog] = useState(false);
	const [authStep, setAuthStep] = useState<"credentials" | "otp">("credentials");

	// Handle dialog close - prevent closing during OTP step
	const handleDialogChange = (open: boolean) => {
		if (!open && authStep === "otp") {
			// Don't close if in OTP step
			return;
		}
		setShowAuthDialog(open);
		if (!open) {
			setAuthStep("credentials");
		}
	};

	if (session.isPending) {
		return <Skeleton className="size-8 rounded-sm border border-gray-300" />;
	}

	if (!session.data) {
		return (
			<>
				<Button
					variant="outline"
					size="sm"
					className="rounded-lg border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 text-xs hover:bg-gray-50"
					onClick={() => setShowAuthDialog(true)}
				>
					<LogInIcon size={14} className="mr-1.5" />
					Login
				</Button>

				<Dialog open={showAuthDialog} onOpenChange={handleDialogChange}>
					<DialogContent className="max-w-md bg-white">
						<DialogHeader>
							<div className="mx-auto mb-2">
								<DictoLogo />
							</div>
							<DialogTitle className="text-center font-medium text-2xl tracking-tight font-display">
								Welcome to Dicto
							</DialogTitle>
							<p className="text-center text-muted-foreground text-sm">
								Sign in to unlock cloud mode and smart features
							</p>
						</DialogHeader>
						<EmailSignIn onStepChange={setAuthStep} />
					</DialogContent>
				</Dialog>
			</>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Avatar className="rounded-sm border border-gray-300 bg-white">
					<AvatarImage
						src={`https://api.dicebear.com/9.x/notionists/svg?seed=${session.data?.user?.email}`}
					/>
					<AvatarFallback>{session.data?.user?.name?.charAt(0)}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" className="mr-4">
				<DropdownMenuLabel className="flex min-w-0 flex-col">
					<span className="truncate font-medium text-foreground text-sm">
						{session.data?.user?.name}
					</span>
					<span className="truncate font-normal text-muted-foreground text-xs">
						{session.data?.user?.email}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => authClient.signOut()}>
					<LogOutIcon size={16} className="opacity-60" aria-hidden="true" />
					<span>Logout</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
