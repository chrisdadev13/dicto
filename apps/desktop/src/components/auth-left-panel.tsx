import type { ReactNode } from "react";

interface AuthLeftPanelProps {
	middleContent: ReactNode;
	bottomContent: ReactNode;
}

export function AuthLeftPanel({
	middleContent,
	bottomContent,
}: AuthLeftPanelProps) {
	return (
		<div className="relative hidden h-full flex-col bg-muted p-10 pb-10 text-white lg:flex dark:border-r border-r">
			<div
				className="pointer-events-none absolute inset-0 z-50"
				style={{
					backgroundImage:
						"url('https://bikhwis00a.ufs.sh/f/h7fo4nF4JUG59YAQBI0cHNKp78qo1dz3ZyQiOFPbv5T0Da6R')",
				}}
			/>
			<div
				className="pointer-events-none absolute inset-0 z-0"
				style={{
					backgroundImage:
          "url('https://bikhwis00a.ufs.sh/f/h7fo4nF4JUG5ZPnawvb3kJbQzt7CAgYeyu5olMdsGUfWqTPa')"
				}}
			/>
			<div className="absolute inset-0 bg-[#0101D9] opacity-50" />
			<div className="relative z-20 mb-32 flex items-center font-medium text-lg" />
			{middleContent}
			<div className="relative z-20 mt-auto">{bottomContent}</div>
		</div>
	);
}
