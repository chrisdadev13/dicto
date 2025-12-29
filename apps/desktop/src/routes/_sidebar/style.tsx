import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { WritingStyleView } from "@/components/writing-style-view";
import { useWritingStyles } from "@/hooks/use-writing-styles";

export const Route = createFileRoute("/_sidebar/style")({
	component: RouteComponent,
});

function RouteComponent() {
	const { selectedStyles, customPrompts, loading, updateStyle } =
		useWritingStyles();

	return (
		<Shell
			title="Writing Style"
			subtitle="Choose how Dicto formats your transcriptions for different apps"
		>
			<WritingStyleView
				selectedStyles={selectedStyles}
				customPrompts={customPrompts}
				loading={loading}
				updateStyle={updateStyle}
			/>
		</Shell>
	);
}
