import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { Resend } from "resend";
import { db } from "../db";
import * as schema from "../db/schema";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
	plugins: [
		bearer(),
		emailOTP({
			sendVerificationOTP: async ({ email, otp }) => {
				try {
					const { error } = await resend.emails.send({
						from: process.env.EMAIL_FROM || "noreply@usedicto.com",
						to: email,
						subject: "Your Dicto verification code",
						html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
					});
					if (error) {
						console.error("Resend error:", error);
						throw new Error(`Failed to send email: ${error.message}`);
					}
				} catch (err) {
					console.error("Failed to send OTP email:", err);
					throw err;
				}
			},
			sendVerificationOnSignUp: true,
		}),
	],
	trustedOrigins: ["http://localhost:1420", "tauri://localhost"],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true,
		},
		cookies: {
			state: {
				attributes: {
					sameSite: "none",
					secure: true,
				},
			},
		},
	},
});
