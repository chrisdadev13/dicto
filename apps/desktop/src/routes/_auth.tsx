import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SettingsDropdown } from "@/components/settings-dropdown";
import { TitleBar } from "@/components/title-bar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
	beforeLoad: async () => {
		const session = await authClient.getSession()

		if (session.data) {
			throw redirect({
				to: '/home',
				replace: true
			});
		}
	},
	component: AuthLayout,
});

function AuthLayout() {
	return (
		<>
			<TitleBar />
			<div className="container relative grid h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
				<SettingsDropdown />
				<Outlet />
			</div>
		</>
	);
}
