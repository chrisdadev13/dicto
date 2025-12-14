<img width="1536" height="1024" alt="ChatGPT Image 14 dic 2025, 12_26_27 a m" src="https://github.com/user-attachments/assets/c732df89-cfbd-478b-aee9-e594598954c1" />

<p align="center">
  <p align="center">Dicto - The private AI-powered voice dictation</p>
  <p align="center">
   <a href="https://deepwiki.com/chrisdadev13/dicto"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
   <a href="https://x.com/chrisdadev13" target="_blank"><img src="https://img.shields.io/static/v1?label=Follow%20us%20on&message=X&color=black&logo=x" alt="X"></a>
  </p>
</p>

## What is Dicto?

Dicto is an intelligent voice dictation app that transcribes your voice and automatically formats it based on where you're typing. Whether you're sending a casual message to a friend or drafting a professional email, Dicto adapts your words to fit the context.

- **Context-aware formatting** — Dicto detects your active app and applies the right style automatically
- **No typing needed** — Hold a key to record, release to paste. It's that simple
- **Smart AI processing** — Your transcription is polished by AI before it reaches your clipboard
- **Works everywhere** — Slack, iMessage, Gmail, Notion, and more
- **Custom dictionary** — Add technical terms and proper nouns for accurate transcription
- **Text shortcuts** — Create abbreviations that expand into full phrases

## Privacy First Dicto is designed with privacy at its core. 
<p align="center">
  <img width="761" height="519" alt="Screenshot 2025-12-14 at 5 12 53 PM" src="https://github.com/user-attachments/assets/42cf5894-277c-486d-b174-a0b2746be529" />
</p>

Choose between two transcription modes: 
| Mode | Engine | Privacy | Speed | Accuracy | 
|------|--------|---------|-------|----------| 
| **Local** | Whisper Small | ✅ Fully offline | Fast | High | 
| **Cloud** | Deepgram Nova-3 | Encrypted | Real-time | Very High | 

**Local mode** uses OpenAI's Whisper Small model running entirely on your device. No internet connection required, no data sent anywhere. Your voice stays on your machine. 

**Cloud mode** offers real-time streaming transcription via Deepgram for users who prefer speed over complete privacy.

## Installation

- [macOS](https://dicto.app/download) (coming soon)
- Windows (planned)
- Linux (planned)

## Highlights

### Floating Widget

A minimal, always-on-top widget that stays out of your way until you need it. Click or use a keyboard shortcut to start recording.

### Context-Aware Formatting

Dicto automatically detects where you're typing and applies the appropriate writing style:

| App Category | Example Apps | Default Style |
|--------------|--------------|---------------|
| **Personal** | iMessage, WhatsApp, Telegram | Casual — all lowercase, minimal punctuation |
| **Work** | Slack, Teams, Discord | Professional — sentence case, full punctuation |
| **Email** | Mail, Gmail, Outlook | Formal — proper greeting, structured paragraphs |
| **Notes** | Notes, Notion, Obsidian | Structured — markdown headers, bullet points |

### Real-Time Transcription

Powered by Deepgram's Nova-3 model, Dicto captures your voice with high accuracy in real-time. Watch your words appear as you speak.

### AI Post-Processing

Once you stop recording, Dicto uses Groq to intelligently format your transcription. The AI only adjusts:

- Capitalization
- Punctuation
- Line breaks

Your words remain unchanged — just properly formatted for the context.

### Custom Dictionary

Add technical terms, proper nouns, and acronyms to ensure they're transcribed correctly:

- Company names (e.g., "PostgreSQL", "OAuth")
- Industry jargon (e.g., "KPI", "ROI")
- Names of people and places

### Text Shortcuts

Create abbreviations that expand into longer phrases:

| Trigger | Replacement |
|---------|-------------|
| `brb` | be right back |
| `omw` | on my way |
| `addr` | 123 Main Street, City, State 12345 |

### Writing Styles

Choose your preferred style for each category:

**Personal**

- Casual — all lowercase, minimal punctuation
- Brief — sentence case, periods only
- Expressive — lowercase with exclamation marks

**Work**

- Professional — sentence case, full punctuation
- Casual — lowercase with dashes
- Direct — sentence case, periods only

**Email**

- Formal — proper greeting with colons
- Professional — standard business format
- Friendly — warm tone with exclamations

**Notes**

- Structured — markdown headers and bold labels
- Bullets — organized bullet points
- Prose — flowing paragraphs

### Multi-Language Support

Dicto supports transcription in multiple languages:

- English (US, GB)
- Spanish
- French
- German
- Italian
- Portuguese
- Japanese
- Korean
- Chinese

## Tech Stack

Dicto is built with modern, performant technologies:

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Tauri (Rust)
- **Transcription**: Deepgram Nova-3
- **AI Processing**: Groq
- **Database**: SQLite (local)
- **Styling**: TailwindCSS + shadcn/ui

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Rust](https://rustup.rs/) toolchain

### Getting Started

```bash
# Install dependencies
bun install

# Run development server
bun run dev
```

### Desktop App

```bash
# Navigate to desktop app
# Run Tauri development
bun run dev
```
