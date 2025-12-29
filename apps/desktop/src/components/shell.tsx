import type { ReactNode } from "react";

interface ShellProps {
	title: string;
	subtitle: string;
	headerActions?: ReactNode;
  banner?: ReactNode;
	children: ReactNode;
}

export function Shell({
	title,
	headerActions,
  banner,
	children,
}: ShellProps) {
	return (
		<main
			className="mx-0 flex h-full flex-col rounded-sm bg-white"
			style={{
				overscrollBehavior: "none",
			}}
		>
			{/* Header - Dark background */}
			<div className="rounded-t-md px-32 text-foreground">
				<div className="mx-auto w-full pt-12">
					<div className="mb-6 flex items-center justify-between">
						<div>
							<h1 className="mb-2 font-display font-thin text-2xl text-card-foreground">
								{title}
							</h1>
							{/* <p className="mb-6 max-w-md text-muted-foreground text-xs"> */}
							{/* 	{subtitle} */}
							{/* </p> */}
						</div>
						{headerActions && (
							<div className="flex items-center gap-4">{headerActions}</div>
						)}
					</div>
				</div>
        {banner}
			</div>

			{/* Content - Light background */}
			<div
				className="flex-1 border-t border-gray-100 bg-sidebar px-32 pt-10 pb-5"
				style={{
					overscrollBehavior: "none",
				}}
			>
				<div
					style={{
						overscrollBehavior: "none",
					}}
					className="mx-auto flex flex-col"
				>
					{children}
				</div>
			</div>
		</main>
	);
}
