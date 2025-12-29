import { useState } from "react";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CATEGORIES, STYLES as STYLE_CONFIG } from "@/lib/writing-styles";
import type { WritingStyleCategory } from "@/hooks/use-writing-styles";

// Transform STYLES to the format expected by the UI (array with id)
const STYLES: Record<string, { id: string; label: string; example: string }[]> =
	Object.fromEntries(
		Object.entries(STYLE_CONFIG).map(([category, styles]) => [
			category,
			Object.entries(styles).map(([id, style]) => ({
				id,
				label: style.label,
				example: style.example,
			})),
		]),
	);

interface WritingStyleViewProps {
	selectedStyles: Record<string, string>;
	customPrompts: Record<string, string>;
	loading: boolean;
	updateStyle: (
		category: WritingStyleCategory,
		selectedStyle: string,
		customPrompt?: string,
	) => Promise<void>;
}

export function WritingStyleView({
	selectedStyles,
	customPrompts,
	updateStyle,
}: WritingStyleViewProps) {
	const [activeCategory, setActiveCategory] = useState("Personal");

	return (
		<Tabs
			value={activeCategory}
			onValueChange={(value) => setActiveCategory(value)}
		>
			<div className="-mt-6 mb-6 border-b">
				<TabsList variant="underline">
					{CATEGORIES.map((cat) => (
						<TabsTab key={cat.id} value={cat.id}>
							{cat.label}
						</TabsTab>
					))}
				</TabsList>
			</div>

			{CATEGORIES.map((category) => {
				const currentStyles = STYLES[category.id];

				return (
					<TabsPanel key={category.id} value={category.id}>
						{/* Category Description */}
						<div className="-mt-4 mb-4 ml-1 text-muted-foreground text-xs">
							{category.description} · {category.apps.join(", ")}
						</div>

						{/* Style Options */}
						<RadioGroup
							value={selectedStyles[category.id] ?? currentStyles[0]?.id ?? ""}
							onValueChange={(value) => {
								if (typeof value === "string") {
									updateStyle(category.id, value, customPrompts[category.id]);
								}
							}}
							className="space-y-1"
						>
							{currentStyles.map((style) => {
								const selectedValue =
									selectedStyles[category.id] ?? currentStyles[0]?.id;
								const isSelected = selectedValue === style.id;
								const radioId = `${category.id}-${style.id}`;
								return (
									<label
										key={style.id}
										htmlFor={radioId}
										className={cn(
											"group flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-all",
											isSelected
												? "border-primary"
												: "border-border bg-white hover:border-primary/30",
										)}
									>
										<Radio
											id={radioId}
											value={style.id}
											className="mt-0.5 shrink-0"
										/>
										<div className="min-w-0 flex-1">
											<div className="mb-2 font-medium text-foreground text-sm">
												{style.label}
											</div>
											<p
												className={cn(
													"text-muted-foreground text-xs leading-relaxed",
													isSelected ? "whitespace-pre-line" : "line-clamp-1",
												)}
											>
												{style.example}
											</p>
										</div>
									</label>
								);
							})}
						</RadioGroup>
					</TabsPanel>
				);
			})}
		</Tabs>
	);
}
