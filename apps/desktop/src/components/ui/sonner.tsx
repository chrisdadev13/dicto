"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			toastOptions={{
				className:
					"text-xs px-3 py-2 rounded-md border border-[var(--normal-border)]",
			}}
			style={
				{
					/* SIMPLE BLACK & WHITE THEME */
					"--normal-bg": "black", // white background
					"--normal-text": "white", // black text
					"--normal-border": "#00000020", // subtle black border (20% opacity)
					"--border-radius": "6px",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
}
