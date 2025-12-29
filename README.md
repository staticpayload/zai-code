# Z.ai Code

```
 ███████╗ █████╗ ██╗     ██████╗ ██████╗ ██████╗ ███████╗
 ╚══███╔╝██╔══██╗██║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
   ███╔╝ ███████║██║    ██║     ██║   ██║██║  ██║█████╗  
  ███╔╝  ██╔══██║██║    ██║     ██║   ██║██║  ██║██╔══╝  
 ███████╗██║  ██║██║    ╚██████╗╚██████╔╝██████╔╝███████╗
 ╚══════╝╚═╝  ╚═╝╚═╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

**A Z.ai-native AI code editor — CLI-first, interactive editor shell.**

> ⚠️ **DISCLAIMER**: This project is **NOT** affiliated with, endorsed by, or sponsored by Z.ai or Anthropic. It is an independent, open-source project that uses the Z.ai API.

---

## ✨ Features

```
┌─────────────────────────────────────────────────────────────┐
│  ► Interactive editor shell — not a chatbot                │
│  ► Plan → Diff → Apply workflow — no auto-execution        │
│  ► Keyboard-driven settings — BIOS-style config            │
│  ► Model switching — select Z.ai models                    │
│  ► Execution profiles — safe / balanced / fast             │
│  ► Git awareness — branch, dirty state, warnings           │
│  ► Dry-run mode — preview without applying                 │
│  ► Undo/rollback — revert last operation                   │
│  ► Task history — audit log of all operations              │
│  ► Safe file ops — binary blocked, large files warned      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

```bash
npm install -g @staticpayload/zai-code
```

Or run directly with npx:

```bash
npx @staticpayload/zai-code
```

---

## 🚀 Quick Start

```bash
zcode
```

This opens the interactive editor shell:

```
 _____ ___  ___
|__  // _ |/  /
  / // __ | __|
 /___\___|___|  code

Z.ai Code — project: my-project
Mode: edit | State: clean

[edit][clean]> 
```

---

## 📋 Commands

### Navigation
```
┌────────────┬──────────────────────────────────┐
│ Command    │ Description                      │
├────────────┼──────────────────────────────────┤
│ /help      │ Show all commands                │
│ /context   │ Show current context             │
│ /files     │ List open files                  │
│ /open      │ Add file to context              │
│ /workspace │ Show workspace info              │
└────────────┴──────────────────────────────────┘
```

### Execution
```
┌────────────┬──────────────────────────────────┐
│ Command    │ Description                      │
├────────────┼──────────────────────────────────┤
│ /plan      │ Generate execution plan          │
│ /generate  │ Create file changes              │
│ /diff      │ Review pending changes           │
│ /apply     │ Apply changes                    │
│ /undo      │ Rollback last operation          │
└────────────┴──────────────────────────────────┘
```

### Modes & Profiles
```
┌─────────────────┬──────────────────────────────────┐
│ Command         │ Description                      │
├─────────────────┼──────────────────────────────────┤
│ /mode <name>    │ Set mode (edit/explain/review)   │
│ /dry-run on|off │ Toggle dry-run mode              │
│ /profile list   │ List execution profiles          │
│ /profile set    │ Apply a profile                  │
└─────────────────┴──────────────────────────────────┘
```

### Multi-Step Tasks
```
┌────────────┬──────────────────────────────────┐
│ Command    │ Description                      │
├────────────┼──────────────────────────────────┤
│ /decompose │ Break task into steps            │
│ /step      │ Plan current step                │
│ /next      │ Complete and advance             │
│ /skip      │ Skip current step                │
│ /progress  │ Show task progress               │
└────────────┴──────────────────────────────────┘
```

### System
```
┌────────────┬──────────────────────────────────┐
│ Command    │ Description                      │
├────────────┼──────────────────────────────────┤
│ /settings  │ Open interactive settings menu   │
│ /git       │ Show repository status           │
│ /exec      │ Run allowed shell command        │
│ /history   │ View task history                │
│ /doctor    │ System health check              │
│ /reset     │ Reset session                    │
│ /exit      │ Exit zcode                       │
└────────────┴──────────────────────────────────┘
```

---

## 🔧 Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   1. Enter a task                                            │
│      └── "add error handling to auth.ts"                     │
│                                                              │
│   2. System detects intent                                   │
│      └── Intent: CODE_EDIT                                   │
│                                                              │
│   3. Run /plan                                               │
│      └── Plan generated. Steps: 3                            │
│                                                              │
│   4. Run /generate                                           │
│      └── Changes generated. Files: 2                         │
│                                                              │
│   5. Run /diff                                               │
│      └── Review changes before applying                      │
│                                                              │
│   6. Run /apply                                              │
│      └── Applied. Session clean.                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**No changes are made without explicit `/apply`.**

---

## ⚙️ Settings Menu

Run `/settings` to open the interactive menu:

```
┌────────────────────────────────────────────────┐
│ Settings                                       │
├────────────────────────────────────────────────┤
│ [Model] UI Execution Context Debug Exit        │
├────────────────────────────────────────────────┤
│   Select AI model for execution                │
│ > Model: [claude-sonnet-4] claude-3-5-sonnet   │
│                                                │
│                                                │
├────────────────────────────────────────────────┤
│                                                │
├────────────────────────────────────────────────┤
│ ↑↓ navigate  ←→ change  Tab section  Esc exit │
└────────────────────────────────────────────────┘
```

### Sections:
- **Model** — Select AI model
- **UI** — ASCII logo, colors, prompt style
- **Execution** — Confirmation mode, iteration limits
- **Context** — File scope, token limits
- **Debug** — Logging options

---

## 📁 Configuration

```
~/.zai/
├── settings.json      # Global settings
├── config.json        # API configuration
├── state.json         # Session state
└── history.log        # Task history

.zai/
└── settings.json      # Project-specific overrides
```

---

## 🔒 Safety Features

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ No auto-execution — explicit /apply required            │
│  ✓ Dry-run mode — preview changes without applying         │
│  ✓ Undo/rollback — revert last operation                   │
│  ✓ Git warnings — alerts on dirty working tree             │
│  ✓ Binary blocked — prevents binary file modifications     │
│  ✓ Large file warnings — alerts on files >50KB             │
│  ✓ Shell allowlist — only safe commands permitted          │
│  ✓ Bounded loops — max iterations enforced                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📜 Requirements

- Node.js 18 or higher
- Z.ai API key

---

## 📄 License

GPL-3.0

---

## 👤 Author

**StaticPayload** — [GitHub](https://github.com/staticpayload)

---

> ⚠️ **DISCLAIMER**: This project is an independent, open-source tool. It is **NOT** affiliated with, endorsed by, or sponsored by Z.ai, Anthropic, or any related entities. Use of this tool requires your own Z.ai API key and is subject to Z.ai's terms of service.
