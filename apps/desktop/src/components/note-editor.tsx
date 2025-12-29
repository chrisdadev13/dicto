import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface NoteEditorProps {
	content: string;
	onChange?: (content: string) => void;
}

export function NoteEditor({ content, onChange }: NoteEditorProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
			}),
			Placeholder.configure({
				placeholder: "Start speaking your note...",
			}),
		],
		content,
		editorProps: {
			attributes: {
				class: "focus:outline-none min-h-[200px]",
			},
			scrollThreshold: 0,
			scrollMargin: 0,
		},
		onUpdate: ({ editor }) => {
			onChange?.(editor.getHTML());
		},
	});

	useEffect(() => {
		if (editor && content !== editor.getHTML()) {
			editor.commands.setContent(content);
		}
	}, [content, editor]);

	return (
		<div className="note-editor" style={{ overscrollBehavior: "none" }}>
			<EditorContent editor={editor} />
			<style>{`
				.note-editor {
					position: relative;
				}
				.note-editor .tiptap {
					outline: none;
					overflow-anchor: none;
				}
				.note-editor .tiptap > *:first-child {
					margin-top: 0;
				}
				.note-editor .tiptap > * + * {
					margin-top: 0.75rem;
				}
				.note-editor .tiptap p {
					font-size: 0.875rem;
					line-height: 1.625;
					margin: 0;
				}
				.note-editor .tiptap h1,
				.note-editor .tiptap h2,
				.note-editor .tiptap h3 {
					margin: 0;
					padding: 0;
				}
				.note-editor .tiptap h1 {
					font-size: 1.25rem;
					font-weight: 600;
					line-height: 1.4;
				}
				.note-editor .tiptap h2 {
					font-size: 1.125rem;
					font-weight: 600;
					line-height: 1.4;
				}
				.note-editor .tiptap h3 {
					font-size: 1rem;
					font-weight: 500;
					line-height: 1.4;
				}
				.note-editor .tiptap ul,
				.note-editor .tiptap ol {
					margin: 0;
					padding: 0;
					padding-left: 1.5rem;
				}
				.note-editor .tiptap ul {
					list-style-type: disc;
				}
				.note-editor .tiptap ol {
					list-style-type: decimal;
				}
				.note-editor .tiptap li {
					font-size: 0.875rem;
					line-height: 1.625;
				}
				.note-editor .tiptap li p {
					margin: 0;
				}
				.note-editor .tiptap blockquote {
					border-left: 4px solid hsl(var(--muted-foreground) / 0.3);
					padding-left: 1rem;
					margin: 0;
					font-style: italic;
					color: hsl(var(--muted-foreground));
				}
				.note-editor .tiptap code {
					background-color: hsl(var(--muted));
					padding: 0.125rem 0.375rem;
					border-radius: 0.25rem;
					font-family: monospace;
					font-size: 0.75rem;
				}
				.note-editor .tiptap pre {
					background-color: hsl(var(--muted));
					padding: 1rem;
					border-radius: 0.5rem;
					overflow-x: auto;
					margin: 0;
				}
			.note-editor .tiptap pre code {
				background: none;
				padding: 0;
			}
			.note-editor .tiptap > p:first-child.is-empty::before {
				content: attr(data-placeholder);
				color: hsl(var(--muted-foreground));
				float: left;
				height: 0;
				pointer-events: none;
			}
			.note-editor .tiptap > p:first-child.is-editor-empty::before {
				content: attr(data-placeholder);
				color: hsl(var(--muted-foreground));
				float: left;
				height: 0;
				pointer-events: none;
			}
			`}</style>
		</div>
	);
}
