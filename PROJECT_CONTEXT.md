# Z.ai Code - Project Context

## Overview
CLI-first AI code editor using Z.ai GLM models. Published to npm as `@staticpayload/zai-code`.

---

## Quick Commands

```bash
# Build
npm run build

# Build + Publish (patch version)
npm run build && npm version patch && npm publish --access public

# Full release
git add -A && git commit -m "feat: description" && npm version patch && npm publish --access public && git push --tags && git push

# Create GitHub release
gh release create v1.2.X --title "vX.X.X - Title" --notes-file RELEASE_NOTES.md
```

---

## Project Structure

```
zai-code/
├── src/                    # TypeScript source
│   ├── cli.ts              # Entry point
│   ├── tui.ts              # Terminal UI (blessed)
│   ├── auth.ts             # Z_KEY authentication
│   ├── runtime.ts          # API calls to Z.ai
│   ├── orchestrator.ts     # Input handling, workflows
│   ├── planner.ts          # Plan generation
│   ├── commands.ts         # Slash commands
│   ├── config.ts           # API config
│   ├── settings.ts         # User settings
│   ├── session.ts          # Session state
│   ├── mode_prompts.ts     # System prompts per mode
│   └── apply.ts            # File operations
├── dist/                   # Compiled JS (published to npm)
├── bin/zcode               # CLI entry script
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Authentication

**Environment variable**: `Z_KEY`

```bash
export Z_KEY="your-api-key"
```

Or run `zcode auth` to save to `~/.zai/auth.json` and auto-add to shell profile.

**Auth flow in code** (`src/auth.ts`):
1. Check `process.env.Z_KEY`
2. Fall back to `~/.zai/auth.json`
3. If neither, prompt user and save

---

## API Configuration

**Endpoint**: `https://api.z.ai/api/coding/paas/v4/chat/completions`

Defined in `src/config.ts`:
```typescript
const DEFAULT_CONFIG = {
  api: {
    baseUrl: 'https://api.z.ai/api/coding/paas/v4/',
  },
};
```

**Request format**: OpenAI-compatible (Bearer token, messages array)

---

## Models

Available in `src/settings.ts`:
```typescript
export const ZAI_MODELS = ['glm-4.7', 'glm-4.6', 'glm-4.5'];
```

Default: `glm-4.7`

---

## Modes

Defined in `src/session.ts`:
- `edit` - Default, plan/generate/apply workflow
- `ask` - Read-only Q&A
- `auto` - Execute directly without confirmation
- `explain` - Explain code
- `review` - Review code
- `debug` - Debug analysis

Mode prompts in `src/mode_prompts.ts`.

---

## TUI (Terminal UI)

Uses `blessed` library. Key files:
- `src/tui.ts` - Main TUI logic
- Input handling with command palette
- Status bar shows: `[mode] | git-branch | model`

**Important blessed settings** for input to work:
```typescript
const input = blessed.textbox({
  keys: true,
  mouse: true,
  inputOnFocus: true,
  // ...
});
```

---

## Key Workflows

### Orchestrator (`src/orchestrator.ts`)
Routes user input to appropriate handler:
- `slash_command` → execute command
- `capture_intent` → save intent, suggest `/plan`
- `ask_question` → call API, show response
- `auto_execute` → call API, apply files directly

### Response parsing
Uses `extractTextFromResponse()` to:
1. Strip markdown code blocks (` ```json `)
2. Parse JSON
3. Extract `explanation`, `output`, or `message` field

---

## Publishing Checklist

1. **Build**: `npm run build`
2. **Test locally**: `node dist/cli.js`
3. **Version**: `npm version patch` (or minor/major)
4. **Publish**: `npm publish --access public`
5. **Push tags**: `git push --tags && git push`
6. **GitHub release**: `gh release create vX.X.X --notes-file RELEASE_NOTES.md`

---

## Common Issues

### TUI not accepting input
- Ensure `keys: true` on textbox
- Check TTY: `process.stdin.isTTY`

### API 404
- Check endpoint in `src/config.ts` and `src/runtime.ts`
- Must use `/chat/completions` not `/messages`

### JSON response showing raw
- Update `extractTextFromResponse()` in `src/orchestrator.ts`

### node_modules in git
- Already fixed with `.gitignore`
- If reappears: `git rm -r --cached node_modules`

---

## Dependencies

```json
{
  "dependencies": {
    "blessed": "^0.1.81"
  },
  "devDependencies": {
    "@types/blessed": "^0.1.25",
    "@types/node": "^20.x",
    "typescript": "^5.x"
  }
}
```

No native dependencies (keytar removed).

---

## Files NOT to commit

```
node_modules/
.zai/
.env
auth.json
*.log
```

All in `.gitignore`.

---

## Repo Links

- **npm**: https://www.npmjs.com/package/@staticpayload/zai-code
- **GitHub**: https://github.com/staticpayload/zai-code
- **Latest release**: https://github.com/staticpayload/zai-code/releases

---

## Current Version

**v1.2.15** (as of Dec 29, 2024)

Key features:
- Z_KEY env var auth
- Z.ai Coding Plan API
- Auto mode
- Response parsing fix
- TUI input fix
