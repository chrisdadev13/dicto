import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import { useCurrentShortcut } from "@/hooks/use-current-shortcut";
import { formatKey, sortKeys } from "@/lib/keyboard-utils";

interface Transcription {
	id: string;
	text: string;
	formattedText: string;
	createdAt: Date;
}

function formatDateGroup(date: Date): string {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const dateStr = date.toDateString();
	const todayStr = today.toDateString();
	const yesterdayStr = yesterday.toDateString();

	if (dateStr === todayStr) {
		return "today";
	}
	if (dateStr === yesterdayStr) {
		return "yesterday";
	}
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function formatTimestamp(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

interface GroupedTranscription {
	id: string;
	text: string;
	formattedText: string;
	date: Date;
	timestamp: string;
}

function groupTranscriptionsByDate(
	transcriptions: Transcription[],
): Record<string, GroupedTranscription[]> {
	const grouped: Record<string, GroupedTranscription[]> = {};

	for (const transcription of transcriptions) {
		const date = transcription.createdAt;
		const dateGroup = formatDateGroup(date);
		const timestamp = formatTimestamp(date);

		if (!grouped[dateGroup]) {
			grouped[dateGroup] = [];
		}

		grouped[dateGroup].push({
			id: transcription.id,
			text: transcription.text,
			formattedText: transcription.formattedText,
			date,
			timestamp,
		});
	}

	return grouped;
}

interface AnalyticsProps {
	totalTranscriptions: number;
	totalWords: number;
}

function Analytics({ totalTranscriptions, totalWords }: AnalyticsProps) {
	const avgWords =
		totalTranscriptions > 0 ? Math.round(totalWords / totalTranscriptions) : 0;

	const stats = [
		{ label: "Transcriptions", value: totalTranscriptions },
		{ label: "Total Words", value: totalWords.toLocaleString() },
		{ label: "Avg. Words", value: avgWords },
	];

	return (
		<div className="flex gap-8 pb-4">
			{stats.map(({ label, value }) => (
				<div key={label} className="flex items-baseline gap-2">
					<span className="font-normal text-2xl tabular-nums">{value}</span>
					<span className="text-muted-foreground text-xs">{label}</span>
				</div>
			))}
		</div>
	);
}

function KeyboardKey({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
	return (
		<div
			className={`flex items-center justify-center rounded-lg border border-b-3 border-gray-200 bg-white px-3 py-3 font-medium text-gray-500 shadow-sm ${wide ? "min-w-24" : "min-w-12"}`}
		>
			{children}
		</div>
	);
}

function EmptyState() {
	const { shortcut } = useCurrentShortcut();
	const sortedKeys = sortKeys(shortcut);

	// Format shortcut for display text (e.g., "Control + Space" or "Fn")
	const shortcutDisplayText = sortedKeys.map(formatKey).join(" + ");

	return (
		<div className="flex flex-1 flex-col items-center justify-center py-16">
			<p className="mb-6 text-muted-foreground text-sm">Start dictating</p>
			<div className="flex items-center gap-3">
				{sortedKeys.map((key, index) => (
					<div key={key} className="flex items-center gap-3">
						{index > 0 && <span className="text-gray-500">+</span>}
						<KeyboardKey wide>
							<span className="text-xs font-normal">{formatKey(key)}</span>
						</KeyboardKey>
					</div>
				))}
			</div>
			<p className="mt-6 max-w-xs text-center text-muted-foreground text-xs">
				Hold {shortcutDisplayText || "your shortcut"} and start speaking. Release when you're done.
			</p>
		</div>
	);
}

interface TranscriptionItemProps {
	transcription: GroupedTranscription;
	onDelete: (id: string) => void;
}

function TranscriptionItem({
	transcription,
	onDelete,
}: TranscriptionItemProps) {
	const handleCopy = () => {
		navigator.clipboard.writeText(transcription.formattedText);
		toast.success("Copied to clipboard");
	};

	const handleDelete = () => {
		onDelete(transcription.id);
	};

	return (
		<div className="group/item flex items-start gap-4 py-4 transition-colors">
			<div className="min-w-0 flex-1 space-y-2">
				<p className="line-clamp-2 text-foreground text-sm leading-relaxed">
					{transcription.formattedText}
				</p>
				<div className="flex items-center gap-2">
					<span className="font-medium text-muted-foreground text-xs">
						{transcription.timestamp}
					</span>
					<span>•</span>
					<span className="font-medium text-muted-foreground text-xs">
						Words: {transcription.text.split(" ").length}
					</span>
				</div>
			</div>
			<ButtonGroup
				orientation="horizontal"
				className="opacity-0 transition-opacity group-hover/item:opacity-100"
			>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={handleCopy}
					className="h-8 w-8 p-0"
				>
					<Copy className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={handleDelete}
					className="h-8 w-8 p-0"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</ButtonGroup>
		</div>
	);
}

export function TranscriptionsListingView() {
	const { transcriptions, analytics, loading, remove, refetch, loadMore, hasMore } =
		useTranscriptions();

	const groupedTranscriptions = useMemo(
		() => groupTranscriptionsByDate(transcriptions),
		[transcriptions],
	);

	const isEmpty = Object.keys(groupedTranscriptions).length === 0;

	if (loading && transcriptions.length === 0) {
		return (
			<>
				<div className="mb-6 grid grid-cols-3 gap-4">
					<div className="space-y-1">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-8 w-12" />
					</div>
					<div className="space-y-1">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-8 w-12" />
					</div>
					<div className="space-y-1">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-8 w-12" />
					</div>
				</div>
				<div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
					<div>
						<div className="sticky top-0 mb-3 flex items-center gap-2 py-2">
							<Skeleton className="h-3 w-24" />
						</div>
						<div className="space-y-3">
							<div className="flex items-start gap-4 rounded-lg px-4 py-2">
								<div className="min-w-0 flex-1">
									<div className="mb-2 flex items-center gap-2">
										<Skeleton className="h-3 w-16" />
										<Skeleton className="h-4 w-20 rounded-full" />
									</div>
									<div className="space-y-1">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-4/5" />
									</div>
								</div>
							</div>
							<div className="flex items-start gap-4 rounded-lg px-4 py-2">
								<div className="min-w-0 flex-1">
									<div className="mb-2 flex items-center gap-2">
										<Skeleton className="h-3 w-16" />
										<Skeleton className="h-4 w-20 rounded-full" />
									</div>
									<div className="space-y-1">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-4/5" />
									</div>
								</div>
							</div>
							<div className="flex items-start gap-4 rounded-lg px-4 py-2">
								<div className="min-w-0 flex-1">
									<div className="mb-2 flex items-center gap-2">
										<Skeleton className="h-3 w-16" />
										<Skeleton className="h-4 w-20 rounded-full" />
									</div>
									<div className="space-y-1">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-4/5" />
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			{isEmpty ? (
				<EmptyState />
			) : (
				<>
					<div className="mb-6 flex items-start justify-between">
						<Analytics
							totalTranscriptions={analytics.totalTranscriptions}
							totalWords={analytics.totalWords}
						/>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={refetch}
							disabled={loading}
							className="h-8 w-8 p-0"
						>
							<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
						</Button>
					</div>
					<div className="min-h-0 flex-1 space-y-6 pr-2">
						{Object.entries(groupedTranscriptions).map(([dateGroup, items]) => (
							<div key={dateGroup}>
								<div className="sticky top-0 mb-3 flex items-center gap-2 bg-sidebar py-2">
									<small className="font-normal text-muted-foreground text-xs capitalize tracking-wider">
										{dateGroup}
									</small>
								</div>
								<div className="space-y-3">
									{items.map((transcription) => {
										return (
											<div
												key={transcription.id}
												className="group/item flex items-center gap-3"
											>
												<div className="flex-1">
													<TranscriptionItem
														transcription={transcription}
														onDelete={remove}
													/>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}
						{hasMore && (
							<div className="flex justify-center py-4">
								<Button
									variant="ghost"
									onClick={loadMore}
									disabled={loading}
									className="text-muted-foreground"
								>
									{loading ? "Loading..." : "Load More"}
								</Button>
							</div>
						)}
					</div>
				</>
			)}
		</>
	);
}
