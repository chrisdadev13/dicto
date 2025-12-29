import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { Loader } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { setToken } from "@/lib//auth-client";

type Mode = "signin" | "signup";
type Step = "credentials" | "otp";

// Form schemas
const signInSchema = z.object({
	email: z.email("Invalid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(100, "Password must be less than 100 characters"),
});

const signUpSchema = z.object({
	email: z.email("Invalid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(100, "Password must be less than 100 characters"),
	name: z.string().min(1, "Name is required"),
});

export function EmailSignIn() {
	const navigate = useNavigate();

	const [mode, setMode] = useState<Mode>("signin");
	const [step, setStep] = useState<Step>("credentials");
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	// Sign in form
	const signInForm = useForm<z.infer<typeof signInSchema>>({
		resolver: zodResolver(signInSchema),
		defaultValues: { email: "", password: "" },
	});

	// Sign up form
	const signUpForm = useForm<z.infer<typeof signUpSchema>>({
		resolver: zodResolver(signUpSchema),
		defaultValues: { email: "", password: "", name: "" },
		mode: "onChange",
	});

	const handleSignIn = async (data: z.infer<typeof signInSchema>) => {
		setIsLoading(true);

		await authClient.signIn.email(
			{
				email: data.email,
				password: data.password,
			},
			{
				onSuccess: async (ctx) => {
					const authToken = ctx.response.headers.get("set-auth-token");
					if (authToken) {
						await setToken(authToken);
						navigate({ to: "/onboarding" });
					}
					setIsLoading(false);
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
					setIsLoading(false);
				},
			},
		);
	};

	const handleSignUp = async (data: z.infer<typeof signUpSchema>) => {
		setIsLoading(true);
		setEmail(data.email);

		// Sign up the user
		const { error } = await authClient.signUp.email({
			email: data.email,
			password: data.password,
			name: data.name,
		});

		if (error) {
			toast.error("Failed to create account. Please try again.");
			setIsLoading(false);
			return;
		}

		// Send OTP
		const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
			email: data.email,
			type: "sign-in",
		});

		if (otpError) {
			toast.error("Failed to send verification code. Please try again.");
			setIsLoading(false);
			return;
		}

		toast.success("Verification code sent to your email!");
		setStep("otp");
		setIsLoading(false);
	};

	const handleOTPComplete = async (otp: string) => {
		setIsLoading(true);

		const { error } = await authClient.signIn.emailOtp({
			email,
			otp,
		});

		if (error) {
			toast.error("Invalid verification code. Please try again.");
			setIsLoading(false);
			return;
		}

		toast.success("Email verified! Welcome to Dicto!");
		setIsLoading(false);
		navigate({ to: "/onboarding" });
	};

	const toggleMode = () => {
		setMode(mode === "signin" ? "signup" : "signin");
		signInForm.reset();
		signUpForm.reset();
	};

	// OTP Verification Step
	if (step === "otp") {
		return (
			<div className="space-y-4 px-3.5">
				<div className="mb-4 space-y-2">
					<p className="font-medium text-sm">Verify your email</p>
					<p className="text-muted-foreground text-sm">
						We sent a 6-digit code to {email}
					</p>
				</div>
				<div className="space-y-4">
					<div className="flex justify-center">
						<InputOTP
							maxLength={6}
							onComplete={handleOTPComplete}
							disabled={isLoading}
							className="w-full"
						>
							<InputOTPGroup>
								<InputOTPSlot className="bg-white" index={0} />
								<InputOTPSlot className="bg-white" index={1} />
								<InputOTPSlot className="bg-white" index={2} />
								<InputOTPSlot className="bg-white" index={3} />
								<InputOTPSlot className="bg-white" index={4} />
								<InputOTPSlot className="bg-white" index={5} />
							</InputOTPGroup>
						</InputOTP>
					</div>
					<Button
						size="sm"
						className="w-full"
						onClick={async () => {
							const { error: otpError } =
								await authClient.emailOtp.sendVerificationOtp({
									email,
									type: "email-verification",
								});

							if (otpError) {
								toast.error("Failed to resend code. Please try again.");
								return;
							}

							toast.success("Verification code resent!");
						}}
						disabled={isLoading}
						isLoading={isLoading}
					>
						{isLoading ? "Verifying..." : "Resend code"}
					</Button>
				</div>
			</div>
		);
	}

	// Sign In Form
	if (mode === "signin") {
		return (
			<div className="space-y-4" key="signin">
				<Form {...signInForm}>
					<form
						onSubmit={signInForm.handleSubmit(handleSignIn)}
						className="space-y-4"
					>
						<FormField
							control={signInForm.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
                      size="lg"
											type="email"
											placeholder="Your email address"
											disabled={isLoading}
											autoFocus
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={signInForm.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
                      size="lg"
											type="password"
											placeholder="Your password"
											disabled={isLoading}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button
							type="submit"
							className="w-full"
							disabled={isLoading || !signInForm.formState.isValid}
							isLoading={isLoading}
						>
							{isLoading && <Loader className="size-4 animate-spin" />}
							Sign In
						</Button>
					</form>
				</Form>
				<div className="text-center">
					<Button
						type="button"
						variant="link"
						size="sm"
						onClick={toggleMode}
						className="text-muted-foreground"
					>
						Don't have an account? Sign up
					</Button>
				</div>
			</div>
		);
	}

	// Sign Up Form
	return (
		<div className="space-y-4" key="signup">
			<Form {...signUpForm}>
				<form
					onSubmit={signUpForm.handleSubmit(handleSignUp)}
					className="space-y-4"
				>
					<FormField
						control={signUpForm.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-muted-foreground text-sm">
									Enter your name
								</FormLabel>
								<FormControl>
									<Input
										type="text"
										placeholder="Enter your name"
										disabled={isLoading}
										autoFocus
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={signUpForm.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-muted-foreground text-sm">
									Email
								</FormLabel>
								<FormControl>
									<Input
										type="email"
										placeholder="Your email address"
										disabled={isLoading}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={signUpForm.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-muted-foreground text-sm">
									Create a password
								</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Create a password"
										disabled={isLoading}
										{...field}
									/>
								</FormControl>
								<p className="text-muted-foreground text-xs">
									Must be at least 8 characters
								</p>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button
						type="submit"
						className="w-full"
						disabled={isLoading || !signUpForm.formState.isValid}
						isLoading={isLoading}
					>
						{isLoading && <Loader className="size-4 animate-spin" />}
						Sign Up
					</Button>
				</form>
			</Form>
			<div className="text-center">
				<Button
					type="button"
					variant="link"
					size="sm"
					onClick={toggleMode}
					className="text-muted-foreground"
				>
					Already have an account? Sign in
				</Button>
			</div>
		</div>
	);
}
