# Z.ai Code

```
 ███████╗ █████╗ ██╗     ██████╗ ██████╗ ██████╗ ███████╗
 ╚══███╔╝██╔══██╗██║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
   ███╔╝ ███████║██║    ██║     ██║   ██║██║  ██║█████╗  
  ███╔╝  ██╔══██║██║    ██║     ██║   ██║██║  ██║██╔══╝  
 ███████╗██║  ██║██║    ╚██████╗╚██████╔╝██████╔╝███████╗
 ╚══════╝╚═╝  ╚═╝╚═╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

A Z.ai-native AI code editor -- CLI-first, interactive editor shell.

> DISCLAIMER: This project is NOT affiliated with, endorsed by, or sponsored by Z.ai or Anthropic. It is an independent, open-source project that uses the Z.ai API.

---

## Features

- Interactive TUI with command palette and keyboard shortcuts
- Multiple modes: edit, ask, auto, explain, review, debug
- Safe workflow: Plan > Generate > Diff > Apply
- Smart task analysis - auto-detects complexity and routes accordingly
- Z.ai GLM models (GLM-4.7 default)
- Git-aware with branch info and dirty state warnings
- Undo/rollback support for all file operations
- Cross-platform: macOS, Linux, Windows

---

## Installation

```bash
npm install -g @staticpayload/zai-code
```

## Authentication

On first run, you'll be prompted for your Z.ai API key:

```bash
zcode auth
```

Or set via environment variable:
```bash
export Z_KEY="your-api-key"
```

---

## Quick Start

```bash
zcode
```

Type a task naturally:
```
add error handling to auth.ts
```

Or use quick commands:
```
/do add input validation       # plan + generate
/run fix the typo in README    # plan + generate + apply (auto)
/ask what does this function do?
```

---

## Commands

### Quick Actions
| Command | Description | Shortcut |
|---------|-------------|----------|
| `/do <task>` | Plan + generate in one step | ^D |
| `/run <task>` | Full auto: plan > generate > apply | ^R |
| `/ask <question>` | Quick question (no file changes) | ^A |
| `/fix <issue>` | Debug and fix an issue | ^F |

### Workflow
| Command | Description | Shortcut |
|---------|-------------|----------|
| `/plan` | Generate execution plan | ^P |
| `/generate` | Create file changes from plan | ^G |
| `/diff` | Review pending changes | |
| `/apply` | Apply pending changes | |
| `/undo` | Rollback last operation | ^Z |
| `/retry` | Retry last failed operation | |
| `/clear` | Clear current task | |

### Files
| Command | Description |
|---------|-------------|
| `/open <path>` | Add file to context |
| `/close <path>` | Remove file from context |
| `/files` | List files in context |
| `/search <query>` | Search files in workspace |
| `/read <path>` | View file contents |
| `/tree` | Show directory tree |

### Modes
| Command | Description |
|---------|-------------|
| `/mode <name>` | Switch mode (auto/edit/ask/debug/review/explain) |
| `/model <name>` | Select AI model |
| `/dry-run` | Toggle dry-run (preview only) |

### Git
| Command | Description |
|---------|-------------|
| `/git` | Git operations (status/log/diff) |
| `/commit` | AI-powered commit message |

### System
| Command | Description | Shortcut |
|---------|-------------|----------|
| `/help` | Show all commands | |
| `/settings` | Open settings panel | F2 |
| `/status` | Show session status | |
| `/doctor` | System health check | |
| `/version` | Show version info | |
| `/reset` | Reset entire session | |
| `/exit` | Exit zcode | ^C |

---

## Modes

| Mode | Description |
|------|-------------|
| `auto` | YOLO mode - execute tasks directly without confirmation |
| `edit` | Default - plan/generate/apply workflow with review |
| `ask` | Read-only - answer questions, no file changes |
| `debug` | Investigate and fix issues |
| `review` | Code review and analysis |
| `explain` | Explain code concepts |

Switch modes:
```
/mode auto
/mode ask
```

Or cycle with Shift+Tab.

---

## Workflow

Standard workflow (edit mode):
```
1. Type task     >  "add error handling to auth.ts"
2. /plan         >  Generate execution plan
3. /generate     >  Create file changes
4. /diff         >  Review changes
5. /apply        >  Apply changes
6. /undo         >  Rollback if needed
```

Quick workflow:
```
/do <task>       >  Plan + generate in one step
/run <task>      >  Plan + generate + apply (YOLO)
```

No changes are made without explicit /apply (except in auto mode).

---

## Configuration

```
~/.zai/
+-- auth.json          # API key
+-- settings.json      # User preferences
+-- config.json        # API configuration
+-- history.log        # Task history

.zai/                  # Project-level (gitignored)
+-- workspace.json     # Session state
+-- settings.json      # Project settings
+-- context.md         # Project rules for AI
```

---

## Safety

- [x] No auto-execution in edit mode
- [x] Dry-run mode available
- [x] Undo/rollback support
- [x] Git dirty state warnings
- [x] Binary files blocked
- [x] Large file warnings
- [x] Smart task analysis prevents accidental overwrites

---

## Requirements

- Node.js 18+
- Z.ai API key (https://z.ai)

---

## License

GPL-3.0

---

## Author

StaticPayload - https://github.com/staticpayload

---

> DISCLAIMER: This project is an independent, open-source tool. It is NOT affiliated with, endorsed by, or sponsored by Z.ai, Anthropic, or any related entities.
