# Z.ai Code

```
 ███████╗ █████╗ ██╗     ██████╗ ██████╗ ██████╗ ███████╗    /\_/\
 ╚══███╔╝██╔══██╗██║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝   ( o.o )
   ███╔╝ ███████║██║    ██║     ██║   ██║██║  ██║█████╗      > ^ <
  ███╔╝  ██╔══██║██║    ██║     ██║   ██║██║  ██║██╔══╝  
 ███████╗██║  ██║██║    ╚██████╗╚██████╔╝██████╔╝███████╗
 ╚══════╝╚═╝  ╚═╝╚═╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

A Z.ai-native AI code editor -- CLI-first, interactive TUI with cosmic orange theme.

> DISCLAIMER: This project is NOT affiliated with, endorsed by, or sponsored by Z.ai or Anthropic.

---

## What's New in v2.0.0

- **Cosmic Orange Theme** - Fresh new color scheme
- **Animated Mascot** - Cute cat companion in the header
- **Smart Task Routing** - Auto-detects task complexity
- **Improved Output** - Markdown rendering, structured formatting
- **Better Settings** - Keyboard-driven settings panel

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
| `/ask <question>` | Quick question | ^A |
| `/fix <issue>` | Debug and fix | ^F |

### Workflow
| Command | Description | Shortcut |
|---------|-------------|----------|
| `/plan` | Generate execution plan | ^P |
| `/generate` | Create file changes | ^G |
| `/diff` | Review pending changes | |
| `/apply` | Apply changes | |
| `/undo` | Rollback | ^Z |

### Files
| Command | Description |
|---------|-------------|
| `/open <path>` | Add file to context |
| `/close <path>` | Remove from context |
| `/files` | List open files |
| `/search <q>` | Search workspace |
| `/read <path>` | View file |
| `/tree` | Directory tree |

### System
| Command | Description |
|---------|-------------|
| `/settings` | Settings panel (F2) |
| `/mode <name>` | Switch mode |
| `/model <name>` | Select model |
| `/git` | Git operations |
| `/commit` | AI commit message |
| `/help` | Show commands |

---

## Modes

| Mode | Description |
|------|-------------|
| `auto` | YOLO - execute directly |
| `edit` | Plan/generate/apply workflow |
| `ask` | Read-only Q&A |
| `debug` | Fix issues |
| `review` | Code review |
| `explain` | Explain code |

Switch: `/mode auto` or Shift+Tab

---

## Workflow

```
Type task  >  /plan  >  /generate  >  /diff  >  /apply
```

Or quick:
```
/do <task>   # plan + generate
/run <task>  # full auto
```

---

## Configuration

```
~/.zai/
├── auth.json       # API key
├── settings.json   # Preferences
└── config.json     # API config

.zai/               # Project-level
├── workspace.json  # Session
└── context.md      # AI rules
```

---

## Customization

### agents.md

Create an `agents.md` file in your project root to give the AI project-specific instructions:

```markdown
# Project Rules

## Tech Stack
- TypeScript + React
- PostgreSQL database
- Jest for testing

## Coding Standards
- Use functional components
- Prefer async/await over promises
- Always add error handling

## File Structure
- Components in src/components/
- Utils in src/utils/
- Types in src/types/

## Don't
- Don't modify package.json without asking
- Don't delete test files
- Don't use any type
```

The AI will read this file and follow your project-specific rules.

### .zai/context.md

Similar to agents.md but stored in the .zai folder (gitignored by default). Good for personal preferences that shouldn't be shared with the team.

### Settings

Press F2 or `/settings` to configure:
- AI Model (glm-4.7, glm-4.5-air)
- Default Mode (auto, edit, ask, etc.)
- ASCII Logo (on/off)
- Color Theme
- Confirmation Mode
- Shell Execution
- Debug Logging

Settings are stored in `~/.zai/settings.json` (global) or `.zai/settings.json` (project).

### Project-level Settings

Create `.zai/settings.json` in your project for project-specific settings that override global ones:

```json
{
  "model": { "current": "glm-4.7" },
  "execution": { "defaultMode": "edit" },
  "ui": { "asciiLogo": "on" }
}
```

---

## Requirements

- Node.js 18+
- Z.ai API key

---

## License

GPL-3.0

---

## Links

- npm: https://www.npmjs.com/package/@staticpayload/zai-code
- GitHub: https://github.com/staticpayload/zai-code

---

> Independent open-source project. Not affiliated with Z.ai or Anthropic.
