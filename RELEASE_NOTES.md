# v2.0.0 - Cosmic Orange

## Highlights

- Cosmic Orange theme - fresh new color scheme
- Animated mascot - cute cat companion in the header
- Smart task routing - auto-detects complexity
- Improved output formatting with markdown rendering
- Better settings panel - keyboard navigation works immediately

## Cosmic Orange Theme

Complete visual overhaul:
- Orange (#ff8700) and gold (#ffaf00) color palette
- Replaces the old cyan/blue scheme
- Applied to logo, borders, highlights, spinners, status indicators
- Command palette selection in orange
- Mode indicators updated

## Animated Mascot

A cute cat that lives next to the ASCII logo:
- Blinks, looks around, changes expressions
- Animates every 800ms
- Adds personality to the TUI

## Smart Task Routing

zcode now analyzes your input and automatically chooses the best path:
- Chat/greetings -> Quick friendly response
- Questions -> Direct answer, no file changes
- Simple edits -> Immediate execution
- Complex tasks -> Auto-generates plan, then executes

## Output Formatting

AI responses now render markdown properly:
- Headers in bold orange
- Inline code highlighted in gold
- Bullet points with orange icons
- Bold text properly rendered
- Numbered lists with dimmed numbers

## Commands

Quick:
  /do <task>     Plan + generate (^D)
  /run <task>    Full auto (^R)
  /ask <q>       Quick question (^A)
  /fix <issue>   Debug mode (^F)

Workflow:
  /plan, /generate, /diff, /apply, /undo, /retry, /clear

Files:
  /open, /close, /files, /search, /read, /tree

Modes:
  /mode, /model, /dry-run

Git:
  /git, /commit

System:
  /help, /settings, /status, /doctor, /version, /reset, /exit

## Keyboard Shortcuts

  ^D       /do
  ^R       /run
  ^P       /plan
  ^G       /generate
  ^Z       /undo
  ^A       /ask
  ^F       /fix
  F2       Settings
  S-Tab    Cycle modes
  ^C       Exit

## Breaking Changes

- Default mode is now `auto` (was `edit`)
- Color scheme changed from cyan to orange
- Mascot added to header (uses ~12 chars width)
