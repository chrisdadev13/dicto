import { listen } from "@tauri-apps/api/event";
import { createFileRoute } from "@tanstack/react-router";
import { Cloud, CloudOffIcon, Download, ExternalLink, Check, Sparkles } from "lucide-react";
import type { SVGProps } from "react";
import { useState, useEffect } from "react";
import { commands } from "@/bindings";
import { Shell } from "@/components/shell";
import { TranscriptionsListingView } from "@/components/transcriptions-listing-view";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	useSettings,
} from "@/hooks/use-settings";
import { useKeysVault } from "@/hooks/use-keys-vault";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";

interface ModelDownloadState {
	isDownloading: boolean;
	progress: number;
	downloaded: number;
	total: number;
	isDownloaded: boolean;
	error: string | null;
}

const INITIAL_MODEL_STATE: ModelDownloadState = {
	isDownloading: false,
	progress: 0,
	downloaded: 0,
	total: 0,
	isDownloaded: false,
	error: null,
};

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function OpenaiIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 260 256"
			width="1em"
			height="1em"
			{...props}
		>
			<path
				fill="currentColor"
				d="M239.184 106.203a64.72 64.72 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.72 64.72 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.67 64.67 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.77 64.77 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483m-97.56 136.338a48.4 48.4 0 0 1-31.105-11.255l1.535-.87l51.67-29.825a8.6 8.6 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601M37.158 197.93a48.35 48.35 0 0 1-5.781-32.589l1.534.921l51.722 29.826a8.34 8.34 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803M23.549 85.38a48.5 48.5 0 0 1 25.58-21.333v61.39a8.29 8.29 0 0 0 4.195 7.316l62.874 36.272l-21.845 12.636a.82.82 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405zm179.466 41.695l-63.08-36.63L161.73 77.86a.82.82 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.54 8.54 0 0 0-4.4-7.213m21.742-32.69l-1.535-.922l-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.72.72 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391zM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87l-51.67 29.825a8.6 8.6 0 0 0-4.246 7.367zm11.868-25.58L128.067 97.3l28.188 16.218v32.434l-28.086 16.218l-28.188-16.218z"
			/>
		</svg>
	);
}

export const Route = createFileRoute("/_sidebar/home")({
	component: RouteComponent,
});

interface DownloadProgress {
	model: string;
	downloaded: number;
	total: number;
	percentage: number;
}

interface DownloadComplete {
	model: string;
}

interface DownloadError {
	model: string;
	error: string;
}

function RouteComponent() {
  const session = authClient.useSession()
  console.log(session)
	const { settings, setSetting } = useSettings();
	const { hasKey: _, setKey } = useKeysVault();
	const isCloudEnabled = settings.cloudTranscription;
	const isLoggedIn = !!session.data;
	// const isFormattingEnabled = settings.postProcess;

	// Auto-disable cloud mode if user logs out
	useEffect(() => {
		if (!isLoggedIn && isCloudEnabled) {
			setSetting("cloudTranscription", false);
		}
	}, [isLoggedIn, isCloudEnabled, setSetting]);

	const [showKeyDialog, setShowKeyDialog] = useState(false);
	const [groqKeyInput, setGroqKeyInput] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	// Model download dialog state
	const [showModelDialog, setShowModelDialog] = useState(false);
	const [_hasCheckedModels, setHasCheckedModels] = useState(false);
	const [whisperState, setWhisperState] = useState<ModelDownloadState>(INITIAL_MODEL_STATE);

	// Check model status on mount
	useEffect(() => {
		const checkModelStatus = async () => {
			const whisperResult = await commands.checkSttModelStatus("Whisper");

			const whisperDownloaded = whisperResult.status === "ok" && whisperResult.data.downloaded;

			setWhisperState((prev) => ({ ...prev, isDownloaded: whisperDownloaded }));

			// Show dialog if Whisper model is not downloaded
			if (!whisperDownloaded) {
				setShowModelDialog(true);
			}
			setHasCheckedModels(true);
		};

		checkModelStatus();
	}, []);

	// Listen for download events
	useEffect(() => {
		const unlistenProgress = listen<DownloadProgress>(
			"model-download-progress",
			(event) => {
				const { model, downloaded, total, percentage } = event.payload;
				const updateFn = (prev: ModelDownloadState): ModelDownloadState => ({
					...prev,
					isDownloading: true,
					progress: percentage,
					downloaded,
					total,
					error: null,
				});

				if (model === "Whisper Small") {
					setWhisperState(updateFn);
				}
			},
		);

		const unlistenComplete = listen<DownloadComplete>(
			"model-download-complete",
			(event) => {
				const { model } = event.payload;
				const updateFn = (prev: ModelDownloadState): ModelDownloadState => ({
					...prev,
					isDownloading: false,
					progress: 100,
					isDownloaded: true,
					error: null,
				});

				if (model === "Whisper Small") {
					setWhisperState(updateFn);
					setShowModelDialog(false);
				}
			},
		);

		const unlistenError = listen<DownloadError>(
			"model-download-error",
			(event) => {
				const { model, error } = event.payload;
				const updateFn = (prev: ModelDownloadState): ModelDownloadState => ({
					...prev,
					isDownloading: false,
					error,
				});

				if (model === "Whisper Small") {
					setWhisperState(updateFn);
				}
			},
		);

		return () => {
			unlistenProgress.then((fn) => fn());
			unlistenComplete.then((fn) => fn());
			unlistenError.then((fn) => fn());
		};
	}, []);

	const handleDownloadWhisper = async () => {
		setWhisperState((prev) => ({
			...prev,
			isDownloading: true,
			progress: 0,
			error: null,
		}));
		const result = await commands.downloadSttModel("Whisper");
		if (result.status === "error") {
			setWhisperState((prev) => ({
				...prev,
				isDownloading: false,
				error: result.error,
			}));
		}
	};

	const handleSaveKey = async () => {
		if (!groqKeyInput.trim()) return;
		setIsSaving(true);
		await setKey("groq", groqKeyInput.trim());
		setSetting("postProcess", true);
		setGroqKeyInput("");
		setShowKeyDialog(false);
		setIsSaving(false);
	};

	return (
		<>
		{/* Model Download Dialog */}
		<Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
			<DialogContent className="max-w-lg bg-white">
				<DialogHeader>
					<DialogTitle>Download a Transcription Model</DialogTitle>
				</DialogHeader>
				<div className="space-y-3 mt-2">
					{/* Whisper Model */}
					<div className={cn(
						"rounded-lg border p-4 transition-colors",
						whisperState.isDownloaded && "bg-muted/50 border-foreground/20"
					)}>
						<div className="flex items-start gap-3">
							<div className={cn(
								"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
								whisperState.isDownloaded ? "bg-foreground/10" : "bg-muted"
							)}>
								<OpenaiIcon className={cn(
									"h-5 w-5",
									whisperState.isDownloaded ? "text-foreground" : "text-muted-foreground"
								)} />
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between gap-2">
									<div>
										<p className="font-medium text-sm">Whisper Small (multilingual)</p>
										<p className="text-muted-foreground text-xs">~500 MB · Good accuracy</p>
									</div>
									{whisperState.isDownloaded ? (
										<span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
											<Check className="h-4 w-4" />
											Ready
										</span>
									) : (
										<Button
											size="sm"
											variant="outline"
											onClick={handleDownloadWhisper}
											disabled={whisperState.isDownloading}
										>
											{whisperState.isDownloading ? (
												"Downloading..."
											) : (
												<>
													<Download className="mr-1.5 h-3.5 w-3.5" />
													Download
												</>
											)}
										</Button>
									)}
								</div>
								{whisperState.isDownloading && (
									<div className="mt-3">
										<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
											<div
												className="h-full bg-black/50 transition-all duration-300"
												style={{ width: `${whisperState.progress}%` }}
											/>
										</div>
										<p className="mt-1.5 text-muted-foreground text-xs">
											{formatBytes(whisperState.downloaded)} / {formatBytes(whisperState.total)} ({whisperState.progress.toFixed(1)}%)
										</p>
									</div>
								)}
								{whisperState.error && (
									<p className="mt-2 text-destructive text-xs">{whisperState.error}</p>
								)}
							</div>
						</div>
					</div>

				</div>
				<p className="text-muted-foreground text-xs mt-2">
					Models run entirely on your device. No audio data is sent externally.
				</p>
			</DialogContent>
		</Dialog>

		{/* Groq API Key Dialog */}
		<Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
			<DialogContent className="max-w-md bg-white">
				<DialogHeader>
					<DialogTitle>Enable Smart Formatting</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="groq-key" className="text-sm font-medium">
							Groq API Key
						</label>
						<Input
							id="groq-key"
							type="password"
							placeholder="gsk_..."
							value={groqKeyInput}
							onChange={(e) => setGroqKeyInput(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							<a
								href="https://console.groq.com/keys"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 hover:underline"
							>
								Get a free Groq API key
								<ExternalLink className="h-3 w-3" />
							</a>
						</p>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							variant="ghost"
							onClick={() => setShowKeyDialog(false)}
                size="sm"
						>
							Cancel
						</Button>
						<Button
							onClick={handleSaveKey}
							disabled={!groqKeyInput.trim() || isSaving}
                variant="outline"
                size="sm"
						>
							{isSaving ? "Saving..." : "Enable Formatting"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
		<Shell
			title="Welcome to Dicto!"
			subtitle="Let's get started"
			headerActions={
				<div className="flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								className="rounded-xl font-normal text-gray-600 text-xs"
							>
								{isCloudEnabled ? <Cloud /> : <CloudOffIcon />}
								Cloud
								<Switch
									checked={isCloudEnabled}
									disabled={!isLoggedIn}
									onCheckedChange={(checked) =>
										setSetting("cloudTranscription", checked)
									}
								/>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="max-w-xs">
							<div className="space-y-1.5">
								<p className="font-medium text-sm">
									{!isLoggedIn ? (
										"Login Required"
									) : isCloudEnabled ? (
										<>
											<Sparkles className="mr-1 inline-block h-3.5 w-3.5" />
											Cloud Mode Enabled
										</>
									) : (
										"Cloud Mode Disabled"
									)}
								</p>
								<p className="text-muted-foreground text-xs leading-relaxed">
									{!isLoggedIn ? (
										<>
											Sign in to unlock cloud mode with AI-powered formatting and smart features.
										</>
									) : isCloudEnabled ? (
										<>
											AI-powered smart transcriptions with automatic formatting based on your application context.
										</>
									) : (
										<>
											Basic transcription only. Enable cloud mode for AI formatting and smart features.
										</>
									)}
								</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</div>
			}
			banner={
				!isCloudEnabled ? (
					<div className="mb-6 rounded-xl border  bg-white px-5 py-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">

								<div>
									<p className="font-display font-medium text-base text-black">
										{!isLoggedIn ? "Sign in to unlock Cloud Mode" : "Enable Cloud Mode"}
									</p>
									<p className="text-gray-500 text-xs">
										{!isLoggedIn
											? "AI-powered formatting and smart features"
											: "Add intelligent formatting to your transcriptions"
										}
									</p>
								</div>
							</div>
							{isLoggedIn && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setSetting("cloudTranscription", true)}
								>
									Enable
								</Button>
							)}
						</div>
					</div>
				) : null
			}
		>
			<TranscriptionsListingView />
		</Shell>
		</>
	);
}
