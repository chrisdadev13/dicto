import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CircleQuestionMark, HelpCircle, Lock, Mic } from "lucide-react";
import { AuthLeftPanel } from "@/components/auth-left-panel";
import { DictoLogo } from "@/components/dicto-logo";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAccessibilityPermission } from "@/hooks/use-accessibility-permission";
import { useMicrophonePermission } from "@/hooks/use-microphone-permission";

export const Route = createFileRoute("/_auth/onboarding")({
	component: RouteComponent,
});

function RouteComponent() {
	const {
		hasPermission: hasMicrophonePermission,
		isLoading: isMicrophonePermissionLoading,
		requestPermission: requestMicrophonePermission,
	} = useMicrophonePermission();

	const {
		hasPermission: hasAccessibilityPermission,
		isLoading: isAccessibilityPermissionLoading,
		requestPermission: requestAccessibilityPermission,
	} = useAccessibilityPermission();

	const visualType =
		hasMicrophonePermission && hasAccessibilityPermission
			? "ready"
			: !hasMicrophonePermission
				? "microphone"
				: "accessibility";

	return (
		<>
			<AuthLeftPanel
				middleContent={<PermissionVisual type={visualType} />}
				bottomContent={
					<div className="-mt-24 space-y-2 text-center">
						<p className="mx-auto max-w-sm text-2xl">
							{hasMicrophonePermission && hasAccessibilityPermission
								? "You're all set! Dicto is ready to help you work faster"
								: "Grant the necessary permissions to enable voice-powered productivity."}
						</p>
					</div>
				}
			/>
			<div className="lg:p-0">
				<div className="mx-auto flex w-full flex-col justify-center space-y-6 px-20">
					<div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center">
						<div className="space-y-2 text-center">
							<div className="mx-auto flex w-full items-center justify-center">
								<DictoLogo />
							</div>
							<h1 className="mx-auto px-8 font-medium text-xl">
								Allow Dicto to transcribe and type for you
							</h1>
							<p className="mx-auto max-w-xs text-muted-foreground text-sm">
								Dicto needs two permissions to work smoothly. We only use them
								when you turn Dicto on.
							</p>
						</div>

						<div className="mt-6 w-full space-y-4">
							<div className="flex items-center justify-between rounded-lg border border-b-3 bg-white p-2">
								<div className="flex items-center justify-center gap-2 text-left">
									<p className="font-normal text-sm">Transcribe my voice</p>
									<Tooltip>
										<TooltipTrigger>
											<CircleQuestionMark className="h-4 w-4 text-gray-600" />
										</TooltipTrigger>
										<TooltipContent>
											<p className="text-sm">
												Used to convert speech into text.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								<Button
									disabled={
										hasMicrophonePermission || isMicrophonePermissionLoading
									}
									variant="outline"
									className="rounded-md border-b-3 px-3 py-1.5 font-medium text-sm transition"
									size="xs"
									onClick={requestMicrophonePermission}
									isLoading={isMicrophonePermissionLoading}
								>
									{hasMicrophonePermission ? (
										<>
											<Check className="mr-1.5 h-4 w-4" />
											Granted
										</>
									) : (
										"Request permission"
									)}
								</Button>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-b-3 bg-white p-2">
								<div className="flex items-center justify-center gap-2 text-left">
									<p className="font-normal text-sm">
										Type into apps 
									</p>
									<Tooltip>
										<TooltipTrigger>
											<CircleQuestionMark className="h-4 w-4 text-gray-600" />
										</TooltipTrigger>
										<TooltipContent>
											<p className="text-sm">
												Lets Dicto insert text anywhere automatically.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								<Button
									disabled={
										hasAccessibilityPermission ||
										isAccessibilityPermissionLoading
									}
									variant="outline"
									size="xs"
									className="rounded-md border-b-3 px-3 py-1.5 font-medium text-sm transition"
									onClick={requestAccessibilityPermission}
									isLoading={isAccessibilityPermissionLoading}
								>
									{hasAccessibilityPermission ? (
										<>
											<Check className="mr-1.5 h-4 w-4" />
											Granted
										</>
									) : (
										"Request permission"
									)}
								</Button>
							</div>
						</div>

						<Link
							disabled={!hasMicrophonePermission || !hasAccessibilityPermission}
							to="/home"
							className="w-full px-12"
						>
							<Button
								className="mt-5 w-full"
								size="lg"
								disabled={!hasMicrophonePermission || !hasAccessibilityPermission}
							>
								Continue
							</Button>
						</Link>
					</div>
				</div>
			</div>
		</>
	);
}

function PermissionVisual({
	type,
}: {
	type: "microphone" | "accessibility" | "ready";
}) {
	const isMic = type === "microphone";
	const isReady = type === "ready";

	if (isReady) {
		return (
			<div className="z-50 mx-auto mt-14 flex h-100 w-full max-w-sm flex-col">
				<div className="relative w-full">
					{/* Stacked window cards in background */}
					<div className="-top-12 absolute inset-0 mx-auto w-[85%]">
						<div className="h-64 rounded-[20px] bg-white/40 shadow-lg backdrop-blur-sm" />
					</div>
					<div className="-top-7 absolute inset-0 mx-auto w-[92%]">
						<div className="h-64 rounded-[20px] bg-white/50 shadow-lg backdrop-blur-sm" />
					</div>

					{/* Main window card */}
					<div className="relative overflow-hidden rounded-[20px] bg-white/10 shadow-xl ring-1 ring-white/40 ring-inset backdrop-blur-md">
						{/* Window content placeholder */}
						<div className="p-6 pb-4">
							<div className="space-y-3">
								<div className="mx-auto h-2.5 w-2/3 rounded bg-white/20" />
								<div className="mx-auto h-2.5 w-1/2 rounded bg-white/20" />
								<div className="mt-6 h-2.5 w-1/3 rounded bg-white/20" />
							</div>
						</div>

						{/* Success State */}
						<div className="relative isolate mx-3 mb-3">
							<div
								className="-z-10 absolute inset-0 rounded-[20px] bg-white"
								style={{
									boxShadow:
										"rgba(0, 0, 0, 0.08) 0px 0px 0px 0.5px, rgba(0, 0, 0, 0.04) 0px 1.677px 3.354px 0px",
								}}
							/>
							{/* Success content */}
							<div className="flex flex-col items-center justify-center p-8">
								{/* Success icon */}
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-blue-600 bg-blue-50">
									<Check className="h-6 w-6 text-blue-600" strokeWidth={2.5} />
								</div>

								{/* Success text */}
								<p className="mb-2 text-center font-semibold text-base text-gray-900">
									All Set!
								</p>
								<p className="text-center text-gray-600 text-sm leading-snug">
									Dicto is ready to transcribe and type for you. Click continue
									to get started.
								</p>
							</div>
						</div>

						{/* Bottom placeholder bar */}
						<div className="flex items-center justify-center pb-3">
							<div className="h-2.5 w-1/2 rounded bg-white/20" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto mt-20 flex h-100 w-full max-w-sm flex-col">
			<div className="relative z-50 w-full">
				{/* Stacked window cards in background */}
				<div className="-top-12 absolute inset-0 mx-auto w-[85%]">
					<div className="h-64 rounded-[20px] bg-white/40 shadow-lg backdrop-blur-sm" />
				</div>
				<div className="-top-7 absolute inset-0 mx-auto w-[92%]">
					<div className="h-64 rounded-[20px] bg-white/50 shadow-lg backdrop-blur-sm" />
				</div>

				{/* Main window card */}
				<div className="relative overflow-hidden rounded-[20px] bg-white/10 shadow-xl ring-1 ring-white/40 ring-inset backdrop-blur-md">
					{/* Window content placeholder */}
					<div className="p-6 pb-4">
						<div className="space-y-3">
							<div className="mx-auto h-2.5 w-2/3 rounded bg-white/20" />
							<div className="mx-auto h-2.5 w-1/2 rounded bg-white/20" />
							<div className="mt-6 h-2.5 w-1/3 rounded bg-white/20" />
						</div>
					</div>

					{/* Permission Dialog */}
					<div className="relative isolate mx-3 mb-3">
						<div
							className="-z-10 absolute inset-0 rounded-[20px] bg-white"
							style={{
								boxShadow:
									"rgba(0, 0, 0, 0.08) 0px 0px 0px 0.5px, rgba(0, 0, 0, 0.04) 0px 1.677px 3.354px 0px",
							}}
						/>
						{/* Dialog header */}
						<div className="border-gray-100 border-b py-1.5 text-center">
							<span className="font-medium text-gray-900 text-xs">
								{isMic ? "Microphone Access" : "Accessibility Access"}
							</span>
						</div>

						{/* Dialog content */}
						<div className="p-3">
							<div className="flex gap-3">
								{/* Icon */}
								<div className="relative shrink-0">
									<div
										className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 ${isMic ? "bg-blue-50" : "bg-yellow-50"}`}
									>
										{isMic ? (
											<Mic
												className="h-6 w-6 text-blue-600"
												strokeWidth={1.5}
											/>
										) : (
											<Lock
												className="h-6 w-6 text-yellow-600"
												strokeWidth={1.5}
											/>
										)}
									</div>
									<div className="-bottom-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white">
										<svg
											viewBox="0 0 24 24"
											className="h-3 w-3 text-white"
											fill="currentColor"
										>
											<title>Access Badge</title>
											<circle
												cx="12"
												cy="12"
												r="10"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
											/>
											<circle cx="12" cy="8" r="2" />
											<path
												d="M12 12v6M8 16h8"
												strokeWidth="2"
												stroke="currentColor"
												strokeLinecap="round"
											/>
										</svg>
									</div>
								</div>

								{/* Text content */}
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-gray-900 text-xs leading-tight">
										&quot;Dicto&quot; would like to{" "}
										{isMic
											? "access the microphone."
											: "control this computer using accessibility features."}
									</p>
									<p className="mt-1 text-gray-500 text-xs leading-snug">
										Grant access to this application in Privacy & Security
										settings
										{isMic ? "." : ", located in System Settings."}
									</p>
								</div>
							</div>

							{/* Dialog actions */}
							<div className="mt-3 flex items-center justify-between">
								<button
									type="button"
									className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50"
								>
									<HelpCircle className="h-3 w-3" />
								</button>
								<div className="flex gap-2">
									<Button
										variant="outline"
										className="h-7 rounded-lg border-gray-200 bg-white px-3 font-medium text-gray-700 text-xs shadow-sm hover:bg-gray-50"
									>
										Open System Settings
									</Button>
									<Button className="h-7 rounded-lg bg-blue-500 px-4 font-medium text-white text-xs shadow-sm hover:bg-blue-600">
										Deny
									</Button>
								</div>
							</div>
						</div>
					</div>

					{/* Bottom placeholder bar */}
					<div className="flex items-center justify-center pb-3">
						<div className="h-2.5 w-1/2 rounded bg-white/20" />
					</div>
				</div>
			</div>
		</div>
	);
}
