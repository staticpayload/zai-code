# v1.3.0 Release - Major Feature Update

## 🚀 What's New

### New Commands
- `/do <task>` - Quick execute: plan + generate in one step
- `/run <task>` - Full auto: plan + generate + apply (YOLO)
- `/retry` - Retry last failed operation
- `/clear` - Clear current task and start fresh
- `/fix <desc>` - Quick debug mode task
- `/commit [msg]` - Git commit with auto-generated messages
- `/search <pattern>` - Search files in workspace
- `/read <file>` - View file contents with line numbers
- `/cat <file>` - View full file contents
- `/tree [depth]` - Visual directory tree
- `/ls [path]` - List directory contents
- `/touch <file>` - Create new file
- `/mkdir <dir>` - Create directory
- `/close <file>` - Remove file from context
- `/save` / `/load` - Save/restore session state
- `/status` - Comprehensive status overview
- `/version` - Version and system info

### Enhanced Git Integration
- `/git status` - Shows changed files with colors
- `/git log` - Recent commits
- `/git diff` - Diff stats
- `/git stash` / `/git pop` - Stash management
- `/commit` - Auto-generates commit messages using AI

### Command Shortcuts & Aliases
- `/h` → help, `/q` → exit, `/p` → plan, `/g` → generate
- `/d` → diff, `/a` → apply, `/u` → undo, `/s` → status
- Partial command matching (e.g., `/gen` → `/generate`)

### Improved Diff Display
- Syntax highlighting for additions/deletions
- Line numbers
- Color-coded operations (create=green, modify=yellow, delete=red)
- `/diff full` to see complete file contents

### Better Apply Workflow
- `--force` flag to bypass warnings
- Detailed success/failure reporting
- Auto-logs to history on success
- Clears task state after successful apply

### Enhanced Auto Mode
- Includes workspace context for better results
- Shows applied files with status
- Proper error handling and rollback hints

### Expanded Shell Commands
- Added: python, python3, pip, pip3, rustc, cmake
- Added: docker, kubectl
- Added: touch, mkdir, cp, mv, diff, sort, uniq, sed, awk
- Added: curl, wget (without pipe restrictions)
- Improved dangerous pattern detection

### Better Mode Prompts
- Clearer instructions for complete file content
- No placeholders or ellipsis in generated code
- Improved output format specifications

### Doctor Improvements
- Network connectivity check
- Disk space check
- Git version display
- More detailed diagnostics

---

## 🐛 Bug Fixes

### Authentication & API
- Fixed API key validation for empty keys
- Fixed URL construction (no double slashes)
- Added 401/403 error handling
- Exponential backoff for retries
- JSON parse error handling

### File Operations
- Fixed path validation with basePath
- Fixed applyDiff hunk validation
- Allow create to overwrite existing files
- Better error messages for invalid hunks

### Rollback/Undo
- Ensure parent directories exist when restoring
- Clean up empty directories after undo
- Fixed error message construction

### Settings
- Fixed settings cache mutation bug
- Added clearSettingsCache() function
- Proper deep cloning with structuredClone()

### Shell Execution
- Fixed dangerous pattern regex (allow --verbose flags)
- Handle commands with paths (./script.sh)
- Validate working directory exists
- Fixed exit code handling

### Context Building
- Fixed summarizeFile output size calculation
- Validate root path exists before indexing

### Session Management
- Added initSession() for explicit initialization
- Fixed resetSession to preserve working directory

### History & Logging
- Wrapped file operations in try/catch
- Validate parsed JSON entries

---

## 📊 Stats

- **50+ new commands and features**
- **20+ bug fixes**
- **Improved error handling throughout**
- **Better user experience with shortcuts and aliases**

---

## 📦 Install

```bash
npm install -g @staticpayload/zai-code@1.3.0
zcode auth
zcode
```

---

## Quick Start

```bash
# Interactive mode
zcode

# Quick task execution
zcode
> add input validation to login form
> /do

# Full auto mode
zcode
> /run add error handling to auth.ts

# Ask questions
zcode
> /ask how does the auth flow work?
```

---

## Full Changelog

- `v1.3.0` — Major feature update: 50+ new commands, bug fixes, improved UX
- `v1.2.15` — Fix: Properly parse JSON responses from markdown code blocks
- `v1.2.14` — Feat: Auto mode, retry logic, better TUI input handling
