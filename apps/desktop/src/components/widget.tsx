import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { commands, type KeytermCategory } from "@/bindings";
import { useSettings } from "@/hooks/use-settings";
import {
	type Category,
	getCategoryForApp,
	getSelectedStyleForCategory,
} from "@/lib/writing-styles";
import { X } from "lucide-react";
import { Button } from "./ui/button";

// Helper function to fetch keyterms for a category
async function fetchKeytermsForCategory(
	category: string | null,
): Promise<string[]> {
	try {
		const result = await commands.keytermsList(
			(category as KeytermCategory) ?? null,
		);
		if (result.status === "error") return [];
		// Filter to include "all" category items as well
		return result.data
			.filter((kt) => kt.category === category || kt.category === "all")
			.map((kt) => kt.text);
	} catch (error) {
		console.error("Failed to fetch keyterms:", error);
		return [];
	}
}


type WidgetState = "dictate" | "recording" | "processing";

interface TranscriptionResult {
	channel: {
		alternatives: Array<{
			transcript: string;
			confidence: number;
		}>;
	};
	is_final: boolean;
	start: number;
	end: number;
}

const WAVEFORM_BARS = Array.from({ length: 7 }, (_, i) => ({
	id: `bar-${i}`,
	offset: Math.sin(i * 0.5) * 0.5 + 0.5, // Creates variation between 0-1
}));

const PROCESSING_DOTS = Array.from({ length: 5 }, (_, i) => ({
	id: `dot-${i}`,
	delay: i * 0.1,
}));

export function Widget() {
	const [state, setState] = useState<WidgetState>("dictate");
	const [barHeights, setBarHeights] = useState<number[]>(Array(7).fill(4));
	const [_transcription, setTranscription] = useState<string>("");
	const transcriptionRef = useRef<string>("");
	const seenStartTimestamps = useRef<Set<number>>(new Set());
	const unlistenRefs = useRef<Array<() => void>>([]);
	const detectedCategoryRef = useRef<Category | null>(null);
	const selectedStyleRef = useRef<string | null>(null);
	const { settings } = useSettings();
	const settingsRef = useRef(settings);
	const keytermsRef = useRef<string[]>([]);

	console.log("settings", settings);

	// Keep settings ref in sync with latest settings
	useEffect(() => {
		settingsRef.current = settings;
	}, [settings]);

	// Listen for audio level events and transcription events
	useEffect(() => {
		const setupListeners = async () => {
			// Listen for audio level events
			const audioLevelUnlisten = await listen<number>(
				"audio-level",
				(event) => {
					const level = event.payload;

					// Update bar heights with variation
					const newHeights = WAVEFORM_BARS.map((bar) => {
						const variation = bar.offset * 0.6 + 0.4; // 0.4 to 1.0 range
						const baseHeight = level * 10 * variation; // Scale for widget size (max ~14px)
						return Math.max(4, Math.min(14, baseHeight));
					});
					setBarHeights(newHeights);
				},
			);

			// Listen for transcription results (accumulate text)
			const transcriptionUnlisten = await listen<TranscriptionResult>(
				"transcription-result",
				(event) => {
					const result = event.payload;
					if (
						result.channel?.alternatives?.[0]?.transcript &&
						result.is_final
					) {
						const start = result.start;

						// Check if we've already processed this segment
						if (seenStartTimestamps.current.has(start)) {
							console.log("Skipping duplicate segment with start:", start);
							return;
						}

						// Mark this segment as seen
						seenStartTimestamps.current.add(start);

						const text = result.channel.alternatives[0].transcript;
						console.log("Transcription:", text, "start:", start);
						setTranscription((prev) => {
							const newText = prev ? `${prev} ${text}` : text;
							const trimmed = newText.trim();
							transcriptionRef.current = trimmed; // Keep ref in sync
							return trimmed;
						});
					}
				},
			);

			// Listen for paste-complete event to stop spinner
			const pasteCompleteUnlisten = await listen("paste-complete", () => {
				console.log("Paste complete - stopping spinner");
				setState("dictate");
				setTranscription(""); // Clear transcription after pasting
				transcriptionRef.current = ""; // Clear ref
				seenStartTimestamps.current.clear(); // Clear seen timestamps
			});

			// Listen for transcription errors
			const errorUnlisten = await listen<string>(
				"transcription-error",
				(event) => {
					console.error("Transcription error:", event.payload);
				},
			);

			// Listen for transcription-processing event (local transcription started)
			const transcriptionProcessingUnlisten = await listen(
				"transcription-processing",
				() => {
					console.log(
						"Transcription processing started - switching to processing state",
					);
					setState("processing");
				},
			);

			// Listen for global keyboard shortcut events
			const unlistenStart = await listen("start-listening", async () => {
				console.log("Ctrl pressed - start listening");

				setState((currentState) => {
					if (currentState === "dictate") {
						setTranscription("");
						transcriptionRef.current = "";
						seenStartTimestamps.current.clear();

						// Get frontmost app and start recording
						commands.getFrontmostApp()
							.then(async (appResult) => {
								const currentSettings = settingsRef.current;

								// Detect category first
								let category: Category | null = null;
								if (appResult.status === "ok") {
									const appInfo = appResult.data;
									category = getCategoryForApp(
										appInfo.app_name,
										appInfo.url ?? undefined,
									);
									detectedCategoryRef.current = category;

									// Fetch user's selected style for this category (default to General)
									if (!category) {
										category = "General";
										detectedCategoryRef.current = category;
									}
									selectedStyleRef.current =
										await getSelectedStyleForCategory(category);

									console.log(
										"Detected app:",
										appInfo.app_name,
										"URL:",
										appInfo.url,
										"Category:",
										category,
										"Style:",
										selectedStyleRef.current,
									);
								} else {
									console.error(
										"Failed to detect frontmost app:",
										appResult.error,
									);
									detectedCategoryRef.current = null;
									selectedStyleRef.current = null;
								}

								// Fetch keyterms for the detected category
								const keyterms = await fetchKeytermsForCategory(category);
								keytermsRef.current = keyterms;
								console.log("Keyterms for category:", category, keyterms);

								// Start recording with keyterms
								await commands.startRecording({
									autoDetectLanguage: currentSettings.autoDetectLanguage,
									languages: currentSettings.languages,
									keyterms: keyterms,
									useCloud: currentSettings.cloudTranscription,
								});
							})
							.catch((error) => {
								console.error("Failed to start recording:", error);
								setState("dictate");
								detectedCategoryRef.current = null;
								selectedStyleRef.current = null;
							});

						return "recording";
					}
					return currentState;
				});
			});

			const unlistenStop = await listen("stop-listening", async () => {
				console.log("Ctrl released - stop listening");
				setState((currentState) => {
					if (currentState === "recording") {
						// Stop recording and handle paste asynchronously
						(async () => {
							try {
								setBarHeights(Array(7).fill(4));

								const currentSettings = settingsRef.current;

								// Immediately show processing state
								setState("processing");

								// Use the detected category and style from recording start
								const category = detectedCategoryRef.current;
								const style = selectedStyleRef.current;
								if (
									category &&
									style &&
									currentSettings.postProcess
								) {
									await commands.stopRecording(
										category,
										style,
									);
								} else {
									// Post-processing disabled, unknown app, or no style - paste raw text
									await commands.stopRecording(
										"",
										"",
									);
								}
							} catch (error) {
								console.error("Failed to stop recording:", error);
								setState("dictate");
							}
						})();
						return currentState; // Keep recording state while processing
					}
					return currentState;
				});
			});

			unlistenRefs.current = [
				audioLevelUnlisten,
				transcriptionUnlisten,
				pasteCompleteUnlisten,
				errorUnlisten,
				transcriptionProcessingUnlisten,
				unlistenStart,
				unlistenStop,
			];
		};

		setupListeners();

		return () => {
			unlistenRefs.current.forEach((unlisten) => {
				unlisten();
			});
			unlistenRefs.current = [];
		};
	}, []);

	const isRecording = state === "recording";

	// Start recording handler
	const startRecording = async () => {
		try {
			setTranscription("");
			transcriptionRef.current = "";
			seenStartTimestamps.current.clear();

			const appResult = await commands.getFrontmostApp();

			// Detect category first
			let category: Category | null = null;
			if (appResult.status === "ok") {
				const appInfo = appResult.data;
				category = getCategoryForApp(
					appInfo.app_name,
					appInfo.url ?? undefined,
				);
				detectedCategoryRef.current = category;

				// Fetch user's selected style for this category (default to General)
				if (!category) {
					category = "General";
					detectedCategoryRef.current = category;
				}
				selectedStyleRef.current =
					await getSelectedStyleForCategory(category);

				console.log(
					"Detected app:",
					appInfo.app_name,
					"URL:",
					appInfo.url,
					"Category:",
					category,
					"Style:",
					selectedStyleRef.current,
				);
			} else {
				console.error("Failed to detect frontmost app:", appResult.error);
				detectedCategoryRef.current = null;
				selectedStyleRef.current = null;
			}

			// Fetch keyterms for the detected category
			const keyterms = await fetchKeytermsForCategory(category);
			keytermsRef.current = keyterms;
			console.log("Keyterms for category:", category, keyterms);

			// Start recording with keyterms
			await commands.startRecording({
				autoDetectLanguage: settings.autoDetectLanguage,
				languages: settings.languages,
				keyterms: keyterms,
        useCloud: settings.cloudTranscription
			});

			setState("recording");
		} catch (error) {
			console.error("Failed to start recording:", error);
		}
	};

	const stopRecording = async () => {
		try {
			setBarHeights(Array(7).fill(4)); // Reset to default heights

			// Immediately show processing state
			setState("processing");

			// Use the detected category and style from recording start
			const category = detectedCategoryRef.current;
			const style = selectedStyleRef.current;
			if (category && style && settings.postProcess) {
				await commands.stopRecording(category, style);
			} else {
				// Post-processing disabled, unknown app, or no style - paste raw text
				await commands.stopRecording("", "");
			}
		} catch (error) {
			console.error("Failed to stop recording:", error);
			setState("dictate"); // On error, go back to idle
		}
	};
	useEffect(() => {
		return () => {
			if (isRecording) {
				commands.stopRecording("", "" ).catch(console.error);
			}
		};
	}, [isRecording]);

	if (state === "processing") {
		return (
			<div className="flex h-full w-full items-end justify-center">
				<div className="flex h-7.5 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black px-2.5 shadow-lg">
					{/* Cancel button */}
					<Button
            size="icon-sm"
						type="button"
						onClick={() => {
              setState("dictate");
              stopRecording()
            }}
						className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 z-50"
						aria-label="Cancel processing"
					>
            <X className="text-white size-2.5!" size={1} />

					</Button>
					{/* Processing dots */}
					<div className="flex items-center gap-0.5">
						{PROCESSING_DOTS.map((dot) => (
							<div
								key={dot.id}
								className="h-0.75 w-0.5 animate-pulse rounded-full bg-white"
								style={{
									animationDelay: `${dot.delay}s`,
									animationDuration: "0.8s",
								}}
							/>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (state === "recording") {
		return (
			<div className="flex h-full w-full items-end justify-center">
				<div className="group flex h-7.5 w-12.5 items-center justify-center gap-2 rounded-full border border-white/10 bg-black px-3 shadow-lg transition-all hover:border-white/20">
					{/* Waveform Section */}
					<button
						type="button"
						onClick={stopRecording}
						className="relative flex h-full w-6 cursor-pointer items-center justify-center"
						aria-label="Stop recording"
					>
						<div className="flex h-3.5 items-center justify-center gap-0.5">
							{WAVEFORM_BARS.map((bar, index) => (
								<div
									key={bar.id}
									className="w-0.5 rounded-full bg-white transition-all duration-75"
									style={{
										height: `${barHeights[index]}px`,
									}}
								/>
							))}
						</div>
					</button>
				</div>
			</div>
		);
	}
	return (
		<div className="flex h-full w-full items-end justify-center">
			<div className="group flex h-2.5 w-12.5 items-center justify-center gap-2 rounded-full border border-white/80 bg-black px-3 opacity-70 shadow-lg transition-all hover:border-white/20">
				{/* Waveform/Mic Section */}
				<button
					type="button"
					onClick={startRecording}
					className="relative flex h-full w-6 cursor-pointer items-center justify-center"
					aria-label="Start recording"
				>
					<div className="flex h-3.5 items-center justify-center gap-0.5">
					</div>
				</button>
			</div>
		</div>
	);
}
