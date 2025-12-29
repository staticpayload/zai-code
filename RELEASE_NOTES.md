# v1.4.3 Release - Safety & UX Fixes

## 🛡️ Safety Improvements

### Auto Mode Protection
- Added task validation - vague inputs like "hi" are now treated as questions, not file operations
- Added file path filtering - blocks creating files in `src/` unless explicitly mentioned in task
- Blocks file operations outside project directory
- Better prompts to prevent model from creating random files

### Casual Chat Detection
- Improved greeting detection (hi, hii, hiii, hey, heyyy, yo, etc.)
- Short inputs (≤4 chars) are now properly routed to chat handler
- Auto mode no longer executes file operations for casual chat

## 🎨 UI Improvements

### Big ASCII Logo
- New large "ZAI CODE" ASCII art banner
- Toggle on/off in settings (ASCII Logo setting)

### Settings Menu Fixed
- Completely rewritten settings modal with proper keyboard handling
- Added Default Mode setting - choose startup mode (edit/auto/ask/debug/review/explain)
- Added ASCII Logo toggle
- Up/Down/Enter/Escape all work properly now
- Mouse support for clicking options

### Command Palette Fixed
- Up/Down arrow navigation now works correctly
- Proper filtering of commands as you type
- Tab completion works with selected item

## ⚙️ New Settings

- **Default Mode** - Set which mode zcode starts in (edit, auto, ask, debug, review, explain)
- **ASCII Logo** - Toggle the big ASCII banner on/off

---

# v1.4.2 Release - Core Functionality Fixes

## 🐛 Critical Bug Fixes

### Mode Routing Fixed
- Fixed "hi" and casual chat triggering wrong workflow - now properly routes to chat handler
- Added `isCasualChat()` detection for greetings, small talk, thanks, etc.
- Added `isSimpleQuestion()` for short questions that don't need code context
- New 'chat' workflow type for natural conversation

### File Creation Fixed
- Fixed auto mode not properly parsing file operations from model responses
- Improved `parseFileOperations()` to handle various response formats
- Better JSON extraction from markdown code blocks
- Normalized file paths (removes leading `./`)

### Output Scrolling Fixed
- Added `mouse: true`, `keys: true`, `vi: true` to output log widget
- Chat history is now scrollable with mouse wheel and keyboard

### Mode Cycling Added
- `Shift+Tab` now cycles through modes: edit → auto → ask → debug → review → explain
- Visual feedback when mode changes

### Improved Auto Mode
- Better system prompt for file operations with explicit JSON format
- Fallback handling when model doesn't return structured response
- Shows raw output when no file operations detected

---

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
