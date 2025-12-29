# Z.ai Code

A Z.ai-native AI code editor — CLI-first, interactive editor shell.

**This tool uses Z.ai API exclusively.** No other AI providers.

## Features

- **Interactive editor shell** — not a chatbot, a code editor
- **Plan → Diff → Apply workflow** — no auto-execution
- **Keyboard-driven settings menu** — BIOS-style configuration
- **Model switching** — select from available Z.ai models
- **Execution profiles** — safe, balanced, fast presets
- **Git awareness** — branch, dirty state, warnings
- **Dry-run mode** — preview without applying
- **Undo/rollback** — revert last operation
- **Task history** — audit log of all operations
- **Safe file operations** — binary blocked, large files warned

## Requirements

- Node.js 18 or higher
- Z.ai API key

## Installation

```bash
npm install -g @staticpayload/zai-code
```

Or run directly:

```bash
npx @staticpayload/zai-code
```

## Usage

```bash
zcode
```

This opens the interactive editor shell. The prompt shows current state:

```
[edit][clean]> 
```

### Commands

**Navigation:**
- `/help` — show commands
- `/context` — show current context
- `/files` — list open files
- `/open <path>` — add file to context

**Execution:**
- `/plan` — generate execution plan
- `/generate` — create file changes
- `/diff` — review pending changes
- `/apply` — apply changes
- `/undo` — rollback last operation

**Modes:**
- `/mode <edit|explain|review|debug>` — set mode
- `/dry-run on|off` — toggle dry-run
- `/profile list|set <name>` — manage profiles

**Tasks:**
- `/decompose` — break task into steps
- `/step` — plan current step
- `/next` — complete step and advance

**System:**
- `/settings` — open interactive settings menu
- `/git` — show repository status
- `/exec <cmd>` — run allowed shell command
- `/history` — view task history
- `/doctor` — system health check

### Workflow

1. Enter a task: `add error handling to auth.ts`
2. System detects intent: `Intent: CODE_EDIT`
3. Run `/plan` to generate a plan
4. Run `/generate` to create changes
5. Run `/diff` to review
6. Run `/apply` to execute

No changes are made without explicit `/apply`.

## Settings

Run `/settings` to open the interactive menu:

- **Model** — select AI model
- **UI** — ASCII logo, colors, prompt style
- **Execution** — confirmation mode, iteration limits
- **Context** — file scope, token limits
- **Debug** — logging options

Navigate with arrow keys, Tab between sections, Esc to exit.

## Configuration

Global settings: `~/.zai/settings.json`
Project settings: `.zai/settings.json` (overrides global)

## License

MIT

## Author

StaticPayload <chaitanyamishra.ai@gmail.com>
