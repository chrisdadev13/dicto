import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { Store } from "@tauri-apps/plugin-store";

let store: Store | null = null;

async function getStore(): Promise<Store> {
	if (!store) {
		store = await Store.load("auth.json");
	}
	return store;
}

export const getToken = async (): Promise<string | undefined> => {
	try {
		const s = await getStore();
		return await s.get<string>("token");
	} catch {
		return;
	}
};

export const setToken = async (token: string): Promise<void> => {
	const s = await getStore();
	await s.set("token", token);
	await s.save();
};

export const deleteToken = async (): Promise<void> => {
	try {
		const s = await getStore();
		await s.delete("token");
		await s.save();
	} catch {
		// Ignore error if token doesn't exist
	}
};

const API_BASE_URL = import.meta.env.DEV
	? "http://localhost:3000"
	: "https://dicto-ai-server.vercel.app";

export const authClient = createAuthClient({
	baseURL: API_BASE_URL,
	plugins: [emailOTPClient()],
	fetchOptions: {
		auth: {
			token: () => getToken(),
			type: "Bearer",
		},
	},
});
