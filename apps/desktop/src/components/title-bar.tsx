import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TitleBarProps {
	children?: ReactNode;
	className?: string;
}

export function TitleBar({ children, className }: TitleBarProps) {
	return (
		<div
			data-tauri-drag-region
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			className={cn(
				"fixed top-0 z-50 flex h-[42px] w-screen items-center bg-transparent",
				"pl-20",
				"pr-2",
				className,
			)}
		>
			{children && (
				<div data-no-drag className="flex flex-1 items-center gap-3">
					{children}
				</div>
			)}
		</div>
	);
}
