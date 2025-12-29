import "dotenv/config";
import { createGroq } from "@ai-sdk/groq";
import { cors } from "@elysiajs/cors";
import { generateText } from "ai";
import { Elysia, t } from "elysia";
import { buildSystemPrompt, type Category } from "./ai";
import { auth } from "./auth";

const groq = createGroq({
	apiKey: process.env.GROQ_API_KEY,
});

const allowedOrigins = [
	// Development (Vite dev server)
	"http://localhost:1420",
	// Tauri v2 production origins
	"tauri://localhost",
	"https://tauri.localhost",
	// Additional origins from environment (comma-separated, e.g. for web clients)
	...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || []),
].filter(Boolean);

const app = new Elysia()
	.use(
		cors({
			origin: (request) => {
				const origin = request.headers.get("origin");
				// Allow requests with no origin (e.g., from Tauri's native HTTP client)
				if (!origin) return true;
				if (allowedOrigins.includes(origin)) return true;
				return false;
			},
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.post(
		"/llm/formatting",
		async ({ body, request }) => {
			const session = await auth.api.getSession({
				headers: request.headers,
			});

			if (!session) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				});
			}

			const { category, style, appName, text } = body;

			// Build the system prompt server-side
			const systemPrompt = buildSystemPrompt(
				category as Category,
				style,
				appName,
			);

			const result = await generateText({
				model: groq("llama-3.1-8b-instant"),
				system: systemPrompt,
				prompt: text,
				temperature: 0.1,
			});

			return { formattedText: result.text };
		},
		{
			body: t.Object({
				category: t.String(),
				style: t.String(),
				appName: t.String(),
				text: t.String(),
			}),
		},
	)
	.get("/", () => "OK");

export default app;
