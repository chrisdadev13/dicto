import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

const WAVEFORM_BARS = 4;
const PROCESSING_DOTS = 3;

interface DictationWidgetProps {
	state: "idle" | "recording" | "processing";
}

export function DictationWidget({ state }: DictationWidgetProps) {
	const [barHeights, setBarHeights] = useState<number[]>(
		Array(WAVEFORM_BARS).fill(4),
	);

	useEffect(() => {
		if (state !== "recording") {
			setBarHeights(Array(WAVEFORM_BARS).fill(4));
			return;
		}

		const interval = setInterval(() => {
			setBarHeights(
				Array(WAVEFORM_BARS)
					.fill(0)
					.map(() => Math.random() * 12 + 4),
			);
		}, 100);

		return () => clearInterval(interval);
	}, [state]);

	return (
		<div className="flex h-7.5 w-20.75 items-center justify-center gap-1.5 rounded-full border border-white/30 bg-black/30 px-3">
			{state === "idle" && (
				<>
					<MessageCircle className="h-3.5 w-3.5 text-white/80" />
					<span className="font-medium text-white/80 text-xs">Idle</span>
				</>
			)}

			{state === "recording" && (
				<>
					<div className="flex h-3 items-center gap-0.5">
						{barHeights.map((height, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: we don't care
								key={i}
								className="w-0.5 rounded-full bg-white/80 transition-all duration-100"
								style={{ height: `${height}px` }}
							/>
						))}
					</div>
					<span className="ml-1 font-medium text-white/80 text-xs">Rec</span>
				</>
			)}

			{state === "processing" && (
				<div className="flex items-center gap-1">
					{Array(PROCESSING_DOTS)
						.fill(0)
						.map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: we don't care
								key={i}
								className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80"
								style={{ animationDelay: `${i * 0.15}s` }}
							/>
						))}
				</div>
			)}
		</div>
	);
}
