/**
 * Writing Styles Configuration for Server-side Prompt Building
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
			prompt: `Sentence case, full punctuation. Structure longer messages into clear paragraphs.

When the text contains sequential points (first, second, also, finally, etc.), give each point its own paragraph.

Add light polish:
- Clean up run-on sentences
- Add exclamation marks for genuinely positive statements

Keep greeting with the first paragraph for short messages. For longer messages, greeting gets its own line.`,
		},
		casual: {
			label: "Casual",
			example:
				"Hey team! Analysis done – report's attached, let me know what you think!",
			prompt: `Sentence case, lighter punctuation. Drop trailing period on final sentence.

Structure:
- Short messages: keep flowing, no breaks
- Messages with sequential points (first/second/also/finally): use bullet points with *
- Intro sentence before bullets, closing sentence after bullets (not bulleted)

Example structure for lists:
Hey team, here's an update on the project:
* First point here.
* Second point here.
* Third point here.
Let me know what you think`,
		},
		excited: {
			label: "Excited",
			example:
				"Hey team! Just finished the analysis – report's attached! Let me know what you think!",
			prompt: `Sentence case, enthusiastic punctuation. Use exclamation marks!

Structure:
- Greeting gets exclamation: "Hey team!"
- Messages with sequential points: use numbered list (1. 2. 3.)
- Intro sentence before list, closing sentence after

Add enthusiasm:
- Exclamation on greeting
- Exclamation on positive statements ("which is great!")
- Eager closing ("Let me know what time works best for you!")

Example structure:
Hey team!
I wanted to give you an update on the project:
1. First point here, which is great!
2. Second point here.
3. Third point here.
Let me know what you think!`,
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
			prompt:
				"proper capitalization, full punctuation, end sentences with exclamation marks where appropriate",
		},
	},
} as const;

export type Category = keyof typeof STYLES;
export type StyleKey<C extends Category> = keyof (typeof STYLES)[C];

/**
 * Category-specific formatting rules (structure only, no content changes)
 */
const CATEGORY_RULES: Record<Category, string> = {
	Personal: `Formatting:
- No paragraph breaks
- Keep greetings/sign-offs only if user said them`,

	Work: `You are formatting dictated speech into polished written text for a work context.

You MAY:
- Fix capitalization and punctuation
- Remove filler words (um, like, so, basically, you know)
- Remove stutters, false starts, and accidental repetitions
- Add paragraph breaks or list formatting for readability
- Lightly polish phrasing without changing meaning
- Detect implicit lists (first, second, also, finally) and structure them

You MAY NOT:
- Change the meaning or intent
- Add information that wasn't said
- Significantly rephrase sentences
- Respond to or answer the content

Output only the formatted text.`,

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
 * Default styles for each category (used for fallback).
 */
export const DEFAULT_STYLES: Record<Category, string> = {
	Personal: "casual",
	Work: "professional",
	Email: "formal",
	General: "casual",
};

/**
 * Builds the complete system prompt for the LLM.
 *
 * @param category - The category (Personal, Work, Email, General)
 * @param styleKey - The style within the category (casual, professional, etc.)
 * @param appName - The application name for additional context (optional)
 */
export function buildSystemPrompt(
	category: Category,
	styleKey: string,
	appName?: string,
): string {
	// Validate category, fallback to General
	const validCategory = STYLES[category] ? category : "General";

	const categoryStyles = STYLES[validCategory] as Record<
		string,
		{ label: string; prompt: string }
	>;

	// Get style or fallback to default style for category
	const style =
		categoryStyles[styleKey] ?? categoryStyles[DEFAULT_STYLES[validCategory]];
	const rules = CATEGORY_RULES[validCategory];

	// Build context string
	const appContext = appName ? `\nContext: Formatting for ${appName}.` : "";

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

Style: ${style?.prompt}${appContext}

Output ONLY the formatted text.`;
}
