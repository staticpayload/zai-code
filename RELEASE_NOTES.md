# v1.2.15 Release

## 🎉 What's New

### Authentication Overhaul
- **Removed keytar dependency** — No more macOS Keychain issues
- **Z_KEY environment variable** — Simple, portable authentication
- **Auto shell profile setup** — Adds `export Z_KEY` to `.zshrc`/`.bashrc`
- **Cross-platform support** — Works on macOS, Linux, Windows

### Z.ai Coding Plan API
- **Correct endpoint** — `api.z.ai/api/coding/paas/v4/`
- **Bearer token auth** — Standard OpenAI-compatible format
- **GLM models** — GLM-4.7, GLM-4.6, GLM-4.5

### Auto Mode
- **YOLO mode** — Execute tasks directly without manual steps
- **Direct file operations** — Creates/modifies files automatically
- Use `/mode auto` to enable

### TUI Improvements
- **Fixed input box** — Proper key handling with `keys: true`
- **Removed placeholder overlap** — Clean input area
- **Better console capture** — log, error, warn properly redirected
- **Settings modal fix** — Keyboard navigation works correctly
- **TTY check** — Graceful handling of non-interactive terminals

### Runtime Enhancements
- **Request retries** — Automatic retry on 5xx errors and rate limits
- **60s timeout** — Configurable request timeout
- **Better error messages** — Network and timeout errors clearly explained

### Response Parsing
- **Markdown code block stripping** — No more raw JSON in output
- **Smart field extraction** — Finds explanation/output/message fields
- **Clean text display** — Human-readable responses

---

## 📊 Stats

- **7 versions** since v1.2.8
- **~2,000 lines added**
- **~39,000 lines removed** (keytar and native dependencies)
- **Lighter package** — No native compilation required

---

## 📦 Install

```bash
npm install -g @staticpayload/zai-code@1.2.15
zcode auth
zcode
```

---

## Full Changelog

- `v1.2.15` — Fix: Properly parse JSON responses from markdown code blocks
- `v1.2.14` — Feat: Auto mode, retry logic, better TUI input handling
- `v1.2.13` — Fix: Add keys:true to textbox for proper input
- `v1.2.12` — Fix: Use Z.ai Coding Plan endpoint
- `v1.2.11` — Feat: Switch to OpenAI-compatible format
- `v1.2.10` — Feat: Auto-add Z_KEY to shell profile
- `v1.2.9` — Feat: Replace keytar with Z_KEY env var
