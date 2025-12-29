import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Cmdk } from "@/components/cmdk";
import { TitleBar } from "@/components/title-bar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UserDropdown } from "@/components/user-dropdown";
import {
	checkMicrophonePermission,
	checkAccessibilityPermission,
} from "tauri-plugin-macos-permissions-api";

export const Route = createFileRoute("/_sidebar")({
	beforeLoad: async () => {
		try {
			const [hasMicPermission, hasAccessPermission] = await Promise.all([
				checkMicrophonePermission(),
				checkAccessibilityPermission(),
			]);

			if (!hasMicPermission || !hasAccessPermission) {
				throw redirect({
					to: '/onboarding',
					replace: true
				});
			}
		} catch (error) {
			// If permission check fails, redirect to onboarding to be safe
			console.error('Permission check error:', error);
			throw redirect({
				to: '/onboarding',
				replace: true
			});
		}
	},
	component: SidebarLayout,
});

function SidebarLayout() {


	return (
		<div className="h-screen bg-sidebar">
			<TitleBar className="flex w-full items-center justify-between pt-2">
				<div
					className="flex w-full items-center justify-between pb-2"
					data-tauri-drag-region
				>
					<Button size="icon-sm" variant="ghost">
						<ArrowLeft className="text-gray-400" />
					</Button>
					<Cmdk />
          <UserDropdown />

				</div>
			</TitleBar>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset className="mx-2 mt-10 mb-1 h-[calc(100vh-42px)] overflow-y-auto rounded-lg border bg-white">
					<Outlet />
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
