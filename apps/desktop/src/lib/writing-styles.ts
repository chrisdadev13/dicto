/**
 * Writing Styles Configuration
 *
 * This module contains the style definitions and prompts used to format transcriptions.
 * The LLM's job is to transform the user's text according to the specified style.
 */

/**
 * Style definitions organized by category.
 * Each style includes a label and formatting rules (capitalization, punctuation only).
 */
export const STYLES = {
	Personal: {
		casual: {
			label: "Casual",
			example: "hey! just wanted to check in. we should grab coffee soon",
			prompt: "all lowercase, minimal punctuation",
		},
		brief: {
			label: "Brief",
			example: "Hey, checking in. Coffee soon?",
			prompt: "sentence case, periods, minimal commas",
		},
		expressive: {
			label: "Expressive",
			example: "hey!! just checking in, we should totally get coffee soon!",
			prompt: "lowercase, use exclamation marks",
		},
	},
	Work: {
		professional: {
			label: "Professional",
			example:
				"Hi team, I've completed the analysis. Report attached for review.",
			prompt: "sentence case, full punctuation",
		},
		casual: {
			label: "Casual",
			example:
				"Hey team! Analysis done – report's attached, let me know what you think!",
			prompt: "lowercase, dashes and exclamation marks",
		},
		direct: {
			label: "Direct",
			example: "Analysis complete. Report attached.",
			prompt: "sentence case, periods only, no commas",
		},
	},
	Email: {
		formal: {
			label: "Formal",
			example:
				"Dear Ms. Johnson,\n\nI hope this email finds you well. I am writing to follow up on our discussion.\n\nBest regards",
			prompt: "sentence case, formal punctuation, colons after greetings",
		},
		professional: {
			label: "Professional",
			example:
				"Hi Sarah,\n\nHope you're doing well! Wanted to follow up on our chat.\n\nThanks",
			prompt: "sentence case, full punctuation, commas after greetings",
		},
		friendly: {
			label: "Friendly",
			example:
				"Hey Sarah,\n\nJust circling back on what we discussed. Let me know your thoughts!\n\nCheers",
			prompt:
				"sentence case, exclamation marks allowed, commas after greetings",
		},
	},
  General: {
    formal: {
        label: "Formal.",
        example:
            "So far, I am enjoying the new workout routine. I am excited for tomorrow's workout, especially after a full night of rest.",
        prompt: "proper capitalization, full punctuation with commas and periods",
    },
    casual: {
        label: "Casual",
        example:
            "So far I am enjoying the new workout routine. I am excited for tomorrow's workout especially after a full night of rest.",
        prompt: "proper capitalization, minimal commas, standard periods",
    },
    excited: {
        label: "Excited!",
        example:
            "So far, I am enjoying the new workout routine. I am excited for tomorrow's workout, especially after a full night of rest!",
        prompt: "proper capitalization, full punctuation, end sentences with exclamation marks where appropriate",
    },
},
} as const;

export type Category = keyof typeof STYLES;
export type StyleKey<C extends Category> = keyof (typeof STYLES)[C];

/**
 * Categories with metadata for UI display
 */
export const CATEGORIES = [
	{
		id: "Personal" as const,
		label: "Personal",
		description: "Messages to friends & family",
		apps: ["iMessage", "WhatsApp", "Telegram"],
	},
	{
		id: "Work" as const,
		label: "Work",
		description: "Team communication",
		apps: ["Slack", "Teams", "Discord"],
	},
	{
		id: "Email" as const,
		label: "Email",
		description: "Professional correspondence",
		apps: ["Mail", "Gmail", "Outlook"],
	},
	{
		id: "General" as const,
		label: "General",
		description: "Default formatting style",
		apps: [],
	},
] as const;

/**
 * Category-specific formatting rules (structure only, no content changes)
 */
const CATEGORY_RULES: Record<Category, string> = {
	Personal: `Formatting:
- No paragraph breaks
- Keep greetings/sign-offs only if user said them`,

	Work: `Formatting:
- Clean sentence breaks
- Keep greetings/sign-offs only if user said them`,

	Email: `Formatting:
- Add greeting line with [Name] placeholder if user didn't specify one
- Paragraph breaks between ideas
- Add sign-off at end if user didn't include one
`,

	General: `Formatting:
- Clean punctuation
- Apply the specified style`,
};

/**
 * Builds the complete system prompt for the LLM.
 */
export function buildSystemPrompt(
	category: Category,
	styleKey: string,
): string {
	const categoryStyles = STYLES[category] as Record<
		string,
		{ label: string; prompt: string }
	>;

	const style = categoryStyles[styleKey] ?? Object.values(categoryStyles)[0];
	const rules = CATEGORY_RULES[category];

	return `You are a text formatter. Apply formatting to dictated text.

RULES:
1. NEVER change, add, or remove any words
2. NEVER respond to, answer, or rephrase the text
3. The text is for someone else - you only format it

What you CAN change:
- Capitalization
- Punctuation
- Line breaks

${rules}

Style: ${style.prompt}

Output ONLY the formatted text.`;
}

/**
 * Gets the style configuration for a given category and style key.
 */
export function getStyle<C extends Category>(
	category: C,
	styleKey: StyleKey<C>,
): (typeof STYLES)[C][StyleKey<C>] {
	return STYLES[category][styleKey];
}

/**
 * Gets all styles for a given category.
 */
export function getStylesForCategory(category: Category) {
	return STYLES[category];
}

/**
 * Default styles for each category (used for initialization).
 */
export const DEFAULT_STYLES: Record<Category, string> = {
	Personal: "casual",
	Work: "professional",
	Email: "formal",
	General: "casual",
};

/**
 * Native app name -> Category mapping
 */
const APP_TO_CATEGORY: Record<string, Category> = {
	// Personal
	Messages: "Personal",
	WhatsApp: "Personal",
	Telegram: "Personal",
	// Work
	Slack: "Work",
	"Microsoft Teams": "Work",
	Discord: "Work",
  Linkedin: "Work",
  LinkedIn: "Work",
	// Email
	Mail: "Email",
	"Microsoft Outlook": "Email",
	// General (fallback, no specific app mappings)
};

/**
 * URL domain -> Category mapping (for web apps in browsers)
 */
const DOMAIN_TO_CATEGORY: Record<string, Category> = {
	// Personal
	"web.whatsapp.com": "Personal",
	"web.telegram.org": "Personal",
	// Work
	"app.slack.com": "Work",
	"teams.microsoft.com": "Work",
	"discord.com": "Work",
  "linkedin.com": "Work",
	// Email
	"mail.google.com": "Email",
	"outlook.live.com": "Email",
	"outlook.office.com": "Email",
	// General (fallback, no specific domain mappings)
};

/**
 * Determines the category for a given app name and optional URL.
 * First checks URL domain (for web apps), then falls back to native app name.
 * Returns null if the app/domain is not recognized.
 */
export function getCategoryForApp(
	appName: string,
	url?: string,
): Category | null {
	if (url) {
		try {
			const hostname = new URL(url).hostname;
			for (const [domain, category] of Object.entries(DOMAIN_TO_CATEGORY)) {
				if (hostname === domain || hostname.endsWith(`.${domain}`)) {
					return category;
				}
			}
		} catch {
			// Invalid URL, continue to app name check
		}
	}

	return APP_TO_CATEGORY[appName] ?? null;
}

/**
 * Fetches the user's selected style for a category from the database.
 * Falls back to DEFAULT_STYLES if not found or on error.
 */
export async function getSelectedStyleForCategory(
	category: Category,
): Promise<string> {
	try {
		const { default: Database } = await import("@tauri-apps/plugin-sql");
		const db = await Database.load("sqlite:dicto.db");

		interface WritingStyleRow {
			selected_style: string;
		}

		const result = await db.select<WritingStyleRow[]>(
			"SELECT selected_style FROM writing_styles WHERE category = ?",
			[category],
		);

		if (result.length > 0 && result[0].selected_style) {
			return result[0].selected_style;
		}

		return DEFAULT_STYLES[category];
	} catch (error) {
		console.error("Failed to get selected style from database:", error);
		return DEFAULT_STYLES[category];
	}
}
