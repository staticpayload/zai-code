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

- **Interactive TUI** — Full terminal UI with command palette
- **Multiple Modes** — `edit`, `ask`, `explain`, `review`, `debug`, `auto`
- **Plan → Generate → Apply** — Safe workflow with explicit confirmation
- **Z.ai GLM Models** — Uses GLM-4.7, GLM-4.6, GLM-4.5
- **Git Awareness** — Branch, dirty state, warnings
- **Undo/Rollback** — Revert last operation
- **Cross-Platform** — Works on macOS, Linux, Windows

---

## 📦 Installation

```bash
npm install -g @staticpayload/zai-code
```

## 🔑 Authentication

On first run, you'll be prompted for your Z.ai API key:

```bash
zcode auth
```

This automatically:
1. Saves key to `~/.zai/auth.json`
2. Adds `export Z_KEY="..."` to your shell profile

Or set manually:
```bash
export Z_KEY="your-api-key"
```

---

## 🚀 Quick Start

```bash
zcode
```

This opens the interactive TUI:

```
███████╗ █████╗ ██╗     ██████╗ ██████╗ ██████╗ ███████╗
╚══███╔╝██╔══██╗██║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
  ███╔╝ ███████║██║    ██║     ██║   ██║██║  ██║█████╗  
 ███╔╝  ██╔══██║██║    ██║     ██║   ██║██║  ██║██╔══╝  
███████╗██║  ██║██║    ╚██████╗╚██████╔╝██████╔╝███████╗
╚══════╝╚═╝  ╚═╝╚═╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝

Tips for getting started:
1. Type a task or question to begin.
2. Use /commands for direct actions.
3. /help for more information.

┌──────────────────────────────────────────────────────┐
│ ❯                                                    │
└──────────────────────────────────────────────────────┘

[edit]                    master                    glm-4.7
```

---

## 📋 Commands

| Command         | Description                                      |
| --------------- | ------------------------------------------------ |
| `/help`         | Show all commands                                |
| `/plan`         | Generate execution plan                          |
| `/generate`     | Create file changes                              |
| `/diff`         | Review pending changes                           |
| `/apply`        | Apply changes                                    |
| `/undo`         | Rollback last operation                          |
| `/mode <name>`  | Switch mode (edit/ask/auto/explain/review/debug) |
| `/model <name>` | Switch model (glm-4.7/glm-4.6/glm-4.5)           |
| `/settings`     | Open settings menu                               |
| `/doctor`       | System health check                              |
| `/exit`         | Exit zcode                                       |

---

## 🎯 Modes

| Mode      | Description                                             |
| --------- | ------------------------------------------------------- |
| `edit`    | Default mode — plan and execute code changes            |
| `ask`     | Read-only — ask questions, no file modifications        |
| `auto`    | YOLO mode — execute tasks directly without manual steps |
| `explain` | Explain code without modifications                      |
| `review`  | Review code and suggest improvements                    |
| `debug`   | Debug issues with context-aware analysis                |

Switch modes:
```
/mode auto
/mode ask
```

---

## 🔧 Workflow

```
1. Enter task        → "add error handling to auth.ts"
2. Intent detected   → Intent: CODE_EDIT
3. /plan             → Plan generated
4. /generate         → Changes generated
5. /diff             → Review changes
6. /apply            → Applied!
```

**No changes are made without explicit `/apply`.**

Or use **auto mode** for direct execution:
```
/mode auto
create a hello.py file that prints hello world
```

---

## ⚙️ Configuration

```
~/.zai/
├── auth.json          # API key (auto-generated)
├── settings.json      # User settings
├── config.json        # API configuration
└── workspace.json     # Workspace state
```

---

## 🔒 Safety

- ✅ No auto-execution in edit mode
- ✅ Dry-run mode available
- ✅ Undo/rollback support
- ✅ Git dirty state warnings
- ✅ Binary files blocked
- ✅ Large file warnings

---

## 📜 Requirements

- Node.js 18+
- Z.ai API key ([Get one here](https://z.ai))

---

## 📄 License

GPL-3.0

---

## 👤 Author

**StaticPayload** — [GitHub](https://github.com/staticpayload)

---

> ⚠️ **DISCLAIMER**: This project is an independent, open-source tool. It is **NOT** affiliated with, endorsed by, or sponsored by Z.ai, Anthropic, or any related entities.
