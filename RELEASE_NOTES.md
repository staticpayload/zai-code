# v1.6.0 - Command Palette Redesign & Settings Fix

## What's New

### Redesigned Command Palette
- Clean, categorized command list (Quick, Workflow, Files, Modes, Git, System)
- Keyboard shortcuts displayed inline
- Alias support - type partial names to find commands
- Scrollable list with proper arrow key navigation
- No emojis - clean ASCII symbols only

### Fixed Settings Panel
- Keyboard navigation works immediately on open
- Arrow keys control settings without stealing input focus
- Enter toggles values, Esc saves and closes
- No clicking required

### Fixed Input Placeholder
- Placeholder text properly hides when typing
- No more overlay issues

### Fixed Double Input Bug
- Removed duplicate key handlers causing double character input

## Commands

Quick Actions:
  /do <task>     Plan + generate in one step (^D)
  /run <task>    Full auto execution (^R)
  /ask <q>       Quick question (^A)
  /fix <issue>   Debug mode (^F)

Workflow:
  /plan          Generate plan (^P)
  /generate      Create changes (^G)
  /diff          Review changes
  /apply         Apply changes
  /undo          Rollback (^Z)

Files:
  /open, /close, /files, /search, /read, /tree

Modes:
  /mode          Switch mode
  /model         Select AI model
  /dry-run       Toggle preview mode

Git:
  /git           Git operations
  /commit        AI commit message

System:
  /help          Show commands
  /settings      Settings panel (F2)
  /status        Session status
  /doctor        Health check
  /exit          Exit (^C)

## Keyboard Shortcuts
  ^D     /do
  ^R     /run
  ^P     /plan
  ^G     /generate
  ^Z     /undo
  ^A     /ask
  ^F     /fix
  F2     Settings
  S-Tab  Cycle modes
