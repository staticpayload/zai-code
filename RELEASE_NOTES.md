# v1.4.1 Release - UX Fixes

## 🐛 Bug Fixes

- Fixed command palette navigation - ↑↓ arrow keys now work properly to scroll through commands
- Fixed Tab completion for command selection
- Improved keyboard handling using screen-level events instead of input-level

## 🎨 UI Improvements

- New animated robot mascot that blinks and changes expressions
- Cleaner, more compact header design
- Better navigation hints in quick actions bar
- Mascot animation cleanup on exit

---

# v1.4.0 Release - UX Overhaul & Vibe Coding

## 🎨 Major UX Improvements

### Redesigned TUI
- Modern, cleaner ASCII logo
- Quick actions bar with keyboard shortcuts
- Real-time context line showing project, git, mode, model, and current task
- Smart suggestions that adapt to your current state
- Animated spinner with contextual messages during processing
- File autocomplete for `/open`, `/read`, `/cat`, `/close` commands
- Command history navigation with up/down arrows
- Placeholder text that changes based on mode and state

### Keyboard Shortcuts
- `Ctrl+D` - Quick `/do` (plan + generate)
- `Ctrl+R` - Quick `/run` (full auto)
- `Ctrl+P` - Quick `/plan`
- `Ctrl+G` - Quick `/generate`
- `Ctrl+Z` - Quick `/undo`
- `Ctrl+A` - Quick `/ask`
- `Ctrl+F` - Quick `/fix`
- `Ctrl+C` - Exit

### New Commands
- `/yolo` - Activate auto mode with style
- `/whatnow` - Contextual suggestions based on current state
- `/examples` - Show example tasks to get started
- `/edit` - Quick switch to edit mode
- `/debug` - Quick switch to debug mode
- `/review` - Quick switch to review mode
- `/explain` - Quick switch to explain mode

### Enhanced Help System
- `/help modes` - Detailed mode descriptions with icons
- `/help workflow` - Step-by-step workflow guide
- `/help shortcuts` - All keyboard shortcuts and aliases
- `/help quick` - Quick command reference
- Categorized command listing

### 50+ Command Aliases
- Single letter: `/h`, `/p`, `/g`, `/d`, `/a`, `/u`, `/s`, `/c`, `/f`, `/m`, `/r`, `/x`, `/o`, `/t`, `/v`
- Word aliases: `/gen`, `/show`, `/view`, `/cat`, `/ls`, `/list`, `/add`, `/rm`, `/find`, `/grep`, `/auto`, `/quick`, `/execute`, `/rollback`, `/revert`, `/info`, `/state`, `/check`, `/health`, `/cfg`, `/config`, `/prefs`

### Improved Status Display
- Mode with icons (⚡ auto, ✏️ edit, ❓ ask, 🔧 debug, 👁 review, 📖 explain)
- State indicators (ready, pending, planned, intent)
- Contextual next-step suggestions
- Git status with uncommitted file count

### Better Visual Feedback
- Color-coded mode indicators
- Progress spinners with context-aware messages
- Enhanced diff display with syntax highlighting
- File operation icons (+, ~, -)
- Progress bars for long operations

### UI Helpers
- `progressBar()` - Visual progress indicator
- `spinner()` - Animated spinner frames
- `fileOp()` - Formatted file operations
- `diffLine()` - Syntax-highlighted diff lines
- `table()` - Formatted table output
- `highlight()` - Emphasized text
- `code()` - Code/command formatting

---

## 🚀 Previous Features (v1.3.0)

### Commands
- `/do <task>` - Quick execute: plan + generate
- `/run <task>` - Full auto: plan + generate + apply
- `/retry` - Retry last failed operation
- `/clear` - Clear current task
- `/fix <desc>` - Quick debug mode task
- `/commit [msg]` - AI-powered commit messages
- `/search`, `/read`, `/cat`, `/tree`, `/ls`, `/touch`, `/mkdir`
- `/save`, `/load`, `/status`, `/version`

### Git Integration
- `/git status/log/diff/stash/pop`
- Auto-generated commit messages

### Enhanced Modes
- Auto mode with workspace context
- Better mode prompts for complete code generation

---

## 🐛 Bug Fixes

All bug fixes from v1.3.0 included plus:
- Fixed blessed label type errors
- Fixed duplicate command handler names
- Improved error handling in TUI

---

## 📦 Install

```bash
npm install -g @staticpayload/zai-code@1.4.0
zcode auth
zcode
```

---

## Quick Start

```bash
# Launch interactive TUI
zcode

# Type naturally
> add authentication to the API

# Or use quick commands
> /do add input validation
> /run fix the login bug
> /ask how does this work?

# Keyboard shortcuts
Ctrl+D  → /do
Ctrl+R  → /run
Ctrl+P  → /plan
Ctrl+G  → /generate

# Get help
> /help
> /whatnow
> /examples
```

---

## Full Changelog

- `v1.4.0` — UX overhaul: keyboard shortcuts, smart suggestions, file autocomplete, 50+ aliases
- `v1.3.0` — Major feature update: 50+ new commands, bug fixes, improved UX
- `v1.2.15` — Fix: Properly parse JSON responses from markdown code blocks
- `v1.2.14` — Feat: Auto mode, retry logic, better TUI input handling
