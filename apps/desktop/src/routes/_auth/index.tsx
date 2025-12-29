import { Link, createFileRoute } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthLeftPanel } from "@/components/auth-left-panel";
import { DictationWidget } from "@/components/dictation-widget";
import { DictoLogo } from "@/components/dicto-logo";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { EmailSignIn } from "@/components/email-signin";

export const Route = createFileRoute("/_auth/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<AuthLeftPanel
				middleContent={<ChatBubbles />}
				bottomContent={
					<blockquote className="space-y-2">
						<p className="text-base">
							&ldquo; Type less, do more. Your fingers deserve a break, and
							you're going to break that poor keyboard if you keep typing like
							that &rdquo;
						</p>
						<footer className="text-sm">- My mom</footer>
					</blockquote>
				}
			/>
			<div className="lg:p-0">
				<div className="mx-auto flex w-full flex-col justify-center space-y-6 px-32">
					<div className="flex flex-col space-y-2 text-center">
						<div className="mx-auto">
							<DictoLogo />
						</div>
						<h1 className="font-medium text-2xl tracking-tight font-display">
							Welcome to Dicto
						</h1>
						<p className="text-muted-foreground text-sm">
							Get started with voice-to-text dictation
						</p>
					</div>
          <EmailSignIn />
					<Link
						to="/home"
						className="block text-center text-muted-foreground/60 text-xs hover:text-muted-foreground transition-colors"
					>
						Continue without an account
					</Link>
				</div>
			</div>
		</>
	);
}

interface Message {
	text: string;
	isUser: boolean;
}

function ChatBubbles() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isListening, setIsListening] = useState(false);
	const [showPendingText, setShowPendingText] = useState(false);
	const [pendingResponse, setPendingResponse] = useState<string | null>(null);
	const processingStepRef = useRef<number | null>(null);

	const conversationFlow = [
		{
			sender: "Hey! You should try Dicto, it turns your voice into text.",
			expectedResponse: "That sounds awesome, I'm in!",
		},
		{
			sender: "Just speak naturally and it transcribes everything for you.",
			expectedResponse: "No more typing? Count me in!",
		},
	];
	const [currentStep, setCurrentStep] = useState(0);
	const [showInsight, setShowInsight] = useState(false);

	useEffect(() => {
		// Start the conversation
		if (
			currentStep < conversationFlow.length &&
			messages.length === currentStep * 2
		) {
			// Prevent duplicate processing (React StrictMode runs effects twice)
			if (processingStepRef.current === currentStep) {
				return;
			}
			processingStepRef.current = currentStep;

			// Add sender message with pop animation
			setTimeout(() => {
				setMessages((prev) => [
					...prev,
					{ text: conversationFlow[currentStep].sender, isUser: false },
				]);
				// Start listening after sender message appears
				setTimeout(() => {
					setIsListening(true);
					setPendingResponse(conversationFlow[currentStep].expectedResponse);
				}, 800);
			}, 500);
		}
	}, [currentStep, messages.length]);

	useEffect(() => {
		// Show insight tooltip when conversation is complete
		if (
			currentStep >= conversationFlow.length &&
			messages.length === conversationFlow.length * 2 &&
			!isListening &&
			!pendingResponse
		) {
			// Wait a bit after the last message appears
			const insightTimer = setTimeout(() => {
				setShowInsight(true);
			}, 1000);

			return () => clearTimeout(insightTimer);
		}
	}, [currentStep, messages.length, isListening, pendingResponse]);

	useEffect(() => {
		// Simulate dictation - recording plays, then text fades in
		if (isListening && pendingResponse) {
			// Recording animation plays for 2 seconds
			const recordingTimer = setTimeout(() => {
				// Stop recording
				setIsListening(false);
				// Show the text with fade-in
				setInputValue(pendingResponse);
				setShowPendingText(true);

				// Send the message after fade-in completes
				setTimeout(() => {
					setMessages((prev) => [
						...prev,
						{ text: pendingResponse, isUser: true },
					]);
					setInputValue("");
					setShowPendingText(false);
					setPendingResponse(null);
					// Move to next step
					setTimeout(() => {
						setCurrentStep((prev) => prev + 1);
					}, 600);
				}, 800);
			}, 2000);

			return () => clearTimeout(recordingTimer);
		}
	}, [isListening, pendingResponse]);

	return (
		<div className="z-50 mx-auto flex h-112.5 w-full max-w-80 flex-col -mt-10">
			{/* Hotkey illustration */}
			<div className="flex items-center justify-center gap-2">
				<div
					className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-all duration-200 ${
						isListening
							? "border-white/40 bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.3)]"
							: "border-white/20 bg-white/5"
					}`}
				>
					<kbd
						className={`rounded border px-1.5 py-0.5 font-mono text-xs transition-all duration-200 ${
							isListening
								? "border-white/50 bg-white/30 text-white"
								: "border-white/20 bg-white/10 text-white/60"
						}`}
					>
						fn
					</kbd>
					<span className={`text-xs transition-colors duration-200 ${isListening ? "text-white" : "text-white/50"}`}>
						{isListening ? "Recording..." : "Hold to speak"}
					</span>
				</div>
			</div>

			<div className="z-50 mb-7 flex justify-center mt-10">
				<Tooltip open={showInsight}>
					<TooltipTrigger asChild>
						<div>
							<DictationWidget state={isListening ? "recording" : "idle"} />
						</div>
					</TooltipTrigger>
					{/* <TooltipContent
						side="top"
						sideOffset={12}
						className="fade-in-0 zoom-in-95 max-w-xs animate-in bg-black/30 duration-300"
					>
						<div className="space-y-1.5 text-center">
							<p className="font-semibold text-sm">Insight 💡</p>
							<p className="text-xs leading-relaxed opacity-90">
								Dicto is not just dictation—it's an AI Desktop Assistant. Sign
								up free and transform how you work.
							</p>
						</div>
					</TooltipContent> */}
				</Tooltip>
			</div>

			{/* Messages container */}
			<div className="flex-1 space-y-2 overflow-y-auto">
				{messages.map((message) => (
					<div
						key={message.text}
						className={`animate-[popIn_0.4s_ease-out_forwards] ${message.isUser ? "ml-auto" : ""}`}
					>
						{message.isUser ? (
							<div className="relative isolate ml-auto min-h-10 w-fit min-w-10 max-w-64 px-3.5 py-2.5 text-sm text-white leading-5">
								<div className="-z-10 absolute inset-0 rounded-[20px] ring-1 ring-white/60 ring-inset" />
								{message.text}
							</div>
						) : (
							<div className="flex items-end gap-2">
								<div className="relative isolate min-h-10 w-fit min-w-10 max-w-64 px-3.5 py-2.5 text-black text-sm leading-5">
									<div
										className="-z-10 absolute inset-0 rounded-[20px] bg-white"
										style={{
											boxShadow:
												"rgba(0, 0, 0, 0.08) 0px 0px 0px 0.5px, rgba(0, 0, 0, 0.04) 0px 1.677px 3.354px 0px",
										}}
									/>
									{message.text}
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			{/* Chat input area */}
			<div className="relative">
				<div className="relative isolate">
					<div className="-z-10 absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/60 ring-inset backdrop-blur-sm" />
					<div className="relative flex h-11 w-full items-center px-4 pr-12">
						{isListening ? (
							<div className="flex items-center gap-1">
								<div className="h-3 w-16 animate-pulse rounded bg-white/30" />
								<div
									className="h-3 w-24 animate-pulse rounded bg-white/20"
									style={{ animationDelay: "150ms" }}
								/>
								<div
									className="h-3 w-12 animate-pulse rounded bg-white/20"
									style={{ animationDelay: "300ms" }}
								/>
							</div>
						) : inputValue ? (
							<span
								className={`text-sm text-white transition-opacity duration-500 ${showPendingText ? "opacity-100" : "opacity-0"}`}
							>
								{inputValue}
							</span>
						) : (
							<span className="text-sm text-white/50">Type a message...</span>
						)}
					</div>
					<div
						className={`-translate-y-1/2 absolute top-1/2 right-3 transition-opacity duration-300 ${inputValue ? "opacity-100" : "opacity-50"}`}
					>
						<div
							className={`flex h-6 w-6 items-center justify-center rounded-full ${inputValue ? "bg-blue-500/80" : "bg-white/20"}`}
						>
							<SendIcon size={9} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
