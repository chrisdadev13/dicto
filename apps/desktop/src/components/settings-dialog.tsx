import { listen } from "@tauri-apps/api/event";
import {
	Check,
	ChevronDown,
	Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { commands } from "@/bindings";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Combobox,
	ComboboxChips,
	ComboboxChip,
	ComboboxValue,
	ComboboxInput,
	ComboboxPopup,
	ComboboxEmpty,
	ComboboxList,
	ComboboxItem,
} from "@/components/ui/combobox";
import { useSettings } from "@/hooks/use-settings";
import { useShortcutEditor } from "@/hooks/use-shortcut-editor";
import { shortcutStringToKeys, keysToShortcutString } from "@/lib/keyboard-utils";
import { cn } from "@/lib/utils";
import { ShortcutItem } from "@/components/shortcut-item";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const LANGUAGE_ITEMS = [
	{ value: "en-US", label: "🇺🇸 English (US)" },
	{ value: "en-GB", label: "🇬🇧 English (UK)" },
	{ value: "es", label: "🇪🇸 Spanish" },
	{ value: "fr", label: "🇫🇷 French" },
	{ value: "de", label: "🇩🇪 German" },
	{ value: "it", label: "🇮🇹 Italian" },
	{ value: "pt", label: "🇵🇹 Portuguese" },
	{ value: "ja", label: "🇯🇵 Japanese" },
	{ value: "ko", label: "🇰🇷 Korean" },
	{ value: "zh", label: "🇨🇳 Chinese" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange} modal={false}>
			<DialogContent
				className="max-w-3xl! overflow-hidden bg-white p-0"
				showCloseButton={false}
			>
				<div className="flex h-130">
				{/* Content */}
					<div className="flex-1 overflow-y-auto p-6">
						<GeneralSettings />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function GeneralSettings() {
	const { settings, setSetting } = useSettings();
	const [shortcut, setShortcut] = useState<string[]>([]);
	const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

	// Model states
	const [whisperState, setWhisperState] = useState<ModelDownloadState>(INITIAL_MODEL_STATE);
	const [qwenState, setQwenState] = useState<ModelDownloadState>(INITIAL_MODEL_STATE);

	// Fetch current shortcut on mount
	useEffect(() => {
		const getCurrentShortcut = async () => {
			try {
				const res = await commands.getCurrentShortcut();
				if (res.status === "ok") {
					setShortcut(shortcutStringToKeys(res.data));
				}
			} catch (err) {
				console.error("Failed to fetch shortcut:", err);
			}
		};
		getCurrentShortcut();
	}, []);

	// Check model status on mount
	useEffect(() => {
		const checkModelStatus = async () => {
			const whisperResult = await commands.checkSttModelStatus("Whisper");
			if (whisperResult.status === "ok") {
				setWhisperState((prev) => ({
					...prev,
					isDownloaded: whisperResult.data.downloaded,
				}));
			}
			const qwenResult = await commands.checkLlmModelStatus("Qwen");
			if (qwenResult.status === "ok") {
				setQwenState((prev) => ({
					...prev,
					isDownloaded: qwenResult.data.downloaded,
				}));
			}
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
				} else if (model === "Qwen 0.5B") {
					setQwenState(updateFn);
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
				} else if (model === "Qwen 0.5B") {
					setQwenState(updateFn);
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
				} else if (model === "Qwen 0.5B") {
					setQwenState(updateFn);
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

	const handleSaveShortcut = async (keys: string[]) => {
		setShortcut(keys);
		if (keys.length === 0) return;

		try {
			const shortcutString = keysToShortcutString(keys);
			const result = await commands.changeShortcut(shortcutString);
			if (result.status === "error") {
				console.error("Failed to save shortcut:", result.error);
			}
		} catch (err) {
			console.error("Failed to save shortcut:", err);
		}
	};

	const handleEditShortcut = async () => {
		try {
			await commands.unregisterShortcut();
		} catch (err) {
			console.error("Failed to unregister shortcut:", err);
		}
		startEditing();
	};

	const handleCancelShortcut = async () => {
		cancelEditing();
		// Re-register the original shortcut
		if (shortcut.length > 0) {
			try {
				const shortcutString = keysToShortcutString(shortcut);
				await commands.changeShortcut(shortcutString);
			} catch (err) {
				console.error("Failed to restore shortcut:", err);
			}
		}
	};

	const { isEditing, currentKeys, startEditing, saveShortcut, cancelEditing, setSpecialKey } =
		useShortcutEditor({
			onSave: handleSaveShortcut,
		});

	// Calculate storage used
	const whisperSize = whisperState.isDownloaded ? 0.5 : 0;
	const qwenSize = qwenState.isDownloaded ? 0.4 : 0;
	const storageUsed = whisperSize + qwenSize;
	const totalStorage = 0.9;

	return (
		<div className="space-y-6">
			<div>
				<h3 className="font-medium text-base">General</h3>
				<p className="text-muted-foreground text-sm">
					Configure your preferences.
				</p>
			</div>

			{/* Global Shortcut */}
			<div className="space-y-3">
				<div>
					<Label className="font-medium text-sm">Hotkey</Label>
					<p className="text-muted-foreground text-xs">
						Press this key to start/stop recording
					</p>
				</div>
				<ShortcutItem
					shortcut={shortcut}
					isEditing={isEditing}
					currentKeys={currentKeys}
					onEdit={handleEditShortcut}
					onSave={saveShortcut}
					onCancel={handleCancelShortcut}
					onSetSpecialKey={setSpecialKey}
				/>
			</div>

			<div className="h-px bg-border" />

			{/* Language Selection */}
			<div className="space-y-4">
				<div>
					<Label className="font-medium text-sm">Language</Label>
					<p className="text-muted-foreground text-xs">
						Spoken language for transcription
					</p>
				</div>

				{/* Auto-detect toggle */}
				<SettingToggle
					label="Auto-detect language"
					description="Automatically detect the spoken language"
					checked={settings.autoDetectLanguage}
					onChange={(checked) => setSetting("autoDetectLanguage", checked)}
				/>

				{/* Multi-select Combobox */}
				<div className={cn(settings.autoDetectLanguage && "opacity-50")}>
					<Combobox
						disabled={settings.autoDetectLanguage}
						items={LANGUAGE_ITEMS}
						multiple
						value={LANGUAGE_ITEMS.filter((l) =>
							settings.languages.includes(l.value),
						)}
						onValueChange={(items) => {
							const newLanguages = items.map((i) => i.value);
							if (newLanguages.length > 0) {
								setSetting("languages", newLanguages);
							}
						}}
					>
						<ComboboxChips>
							<ComboboxValue>
								{(value: { value: string; label: string }[]) => (
									<>
										{value?.map((item) => (
											<ComboboxChip aria-label={item.label} key={item.value}>
												{item.label}
											</ComboboxChip>
										))}
										<ComboboxInput
											placeholder={
												value.length > 0 ? undefined : "Select languages..."
											}
											showTrigger={true}
										/>
									</>
								)}
							</ComboboxValue>
						</ComboboxChips>
						<ComboboxPopup>
							<ComboboxEmpty>No languages found.</ComboboxEmpty>
							<ComboboxList>
								{(item) => (
									<ComboboxItem key={item.value} value={item}>
										{item.label}
									</ComboboxItem>
								)}
							</ComboboxList>
						</ComboboxPopup>
					</Combobox>
				</div>
			</div>

			<div className="h-px bg-border" />

			{/* Features Section */}
			<div className="space-y-2">
				<Label className="font-medium text-sm">Features</Label>

				{/* Voice Recognition */}
				<FeatureCard
					title="Voice Recognition"
					description="Transcribes your speech"
					state={whisperState}
					onSetup={handleDownloadWhisper}
				/>
			</div>
			{/* Privacy notice + technical details */}
			<div className="space-y-2 -mt-3">
				<p className="text-muted-foreground text-xs">
					Runs entirely on your device. Nothing sent to the cloud.
				</p>

				<button
					type="button"
					onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
					className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground transition-colors"
				>
					<ChevronDown
						className={cn(
							"h-3 w-3 transition-transform",
							showTechnicalDetails && "rotate-180"
						)}
					/>
					{showTechnicalDetails ? "Hide" : "View"} technical details
				</button>

				{showTechnicalDetails && (
					<div className="mt-3 rounded-lg border bg-white p-4 space-y-3">
						<p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
							Technical Details
						</p>

						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span>Voice Recognition</span>
								<span className="text-muted-foreground text-xs">
									Whisper Small · 0.5 GB · {whisperState.isDownloaded ? "Ready" : "Not downloaded"}
								</span>
							</div>
						</div>

						<div className="h-px bg-border" />

						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>Storage used</span>
							<span>{storageUsed.toFixed(1)} GB of {totalStorage.toFixed(1)} GB</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function FeatureCard({
	title,
	description,
	state,
	onSetup,
}: {
	title: string;
	description: string;
	state: ModelDownloadState;
	onSetup: () => void;
}) {
	return (
		<div className="flex items-center justify-between py-2">
			<div className="flex-1">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
				{state.isDownloading && (
					<div className="mt-2 max-w-48">
						<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full bg-foreground/40 transition-all duration-300"
								style={{ width: `${state.progress}%` }}
							/>
						</div>
					</div>
				)}
				{state.error && (
					<p className="mt-1 text-destructive text-xs">{state.error}</p>
				)}
			</div>
			<div className="ml-4">
				{state.isDownloaded ? (
					<span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
						<Check className="h-3.5 w-3.5" />
						Ready
					</span>
				) : state.isDownloading ? (
					<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Setting up...
					</span>
				) : (
					<Button
						size="sm"
						variant="outline"
						onClick={onSetup}
						className="h-7 text-xs"
					>
						Set up
					</Button>
				)}
			</div>
		</div>
	);
}

function SettingToggle({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between">
			<div>
				<p className="text-sm">{label}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={cn(
					"relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
					checked ? "bg-foreground" : "bg-muted",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
						checked && "translate-x-4",
					)}
				/>
			</button>
		</div>
	);
}

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
