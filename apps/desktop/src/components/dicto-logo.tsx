export function DictoLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
	const sizeClasses = {
		sm: "h-8 w-8 text-2xl",
		md: "h-12 w-12 text-4xl",
		lg: "h-16 w-16 text-5xl",
	};

	return (
		<div
			className={`flex items-center justify-center rounded-md border border-b-3 bg-white p-2 shadow-xs ${sizeClasses[size]}`}
		>
			<h1 className="font-display font-medium">d.</h1>
		</div>
	);
}
