import { getSession } from './session';
import { getPrompt, dim, info as cyan } from './ui';
import { orchestrate } from './orchestrator';
import { getAvailableCommands } from './commands';

export interface InteractiveOptions {
  onExit?: () => void;
}

// Command definitions with descriptions for autocomplete
const COMMAND_DESCRIPTIONS: Record<string, string> = {
  help: 'Show all commands',
  plan: 'Generate execution plan',
  generate: 'Create file changes',
  diff: 'Review pending changes',
  apply: 'Apply changes',
  undo: 'Rollback last operation',
  reset: 'Reset session state',
  exit: 'Exit zcode',
  mode: 'Set mode (edit/explain/review/debug)',
  'dry-run': 'Toggle dry-run mode',
  profile: 'Manage profiles',
  settings: 'Open settings menu',
  context: 'Show current context',
  files: 'List open files',
  open: 'Add file to context',
  workspace: 'Show workspace info',
  git: 'Show git status',
  exec: 'Run shell command',
  history: 'View task history',
  doctor: 'System health check',
  decompose: 'Break task into steps',
  step: 'Plan current step',
  next: 'Complete and advance',
  skip: 'Skip current step',
  progress: 'Show task progress',
  'undo-history': 'View undo history',
};

// Get filtered commands based on input
function getFilteredCommands(input: string): Array<{ name: string; description: string }> {
  const query = input.toLowerCase().replace(/^\//, '');
  const commands = getAvailableCommands();

  return commands
    .filter(cmd => cmd.startsWith(query))
    .map(cmd => ({
      name: cmd,
      description: COMMAND_DESCRIPTIONS[cmd] || '',
    }))
    .slice(0, 8); // Max 8 suggestions
}

// Render suggestions dropdown
function renderSuggestions(
  suggestions: Array<{ name: string; description: string }>,
  selectedIndex: number,
  promptLength: number
): void {
  if (suggestions.length === 0) return;

  // Move cursor to new line and show suggestions
  process.stdout.write('\n');

  for (let i = 0; i < suggestions.length; i++) {
    const cmd = suggestions[i];
    const prefix = i === selectedIndex ? '>' : ' ';
    const highlight = i === selectedIndex;

    const line = ` ${prefix} /${cmd.name.padEnd(12)} ${dim(cmd.description)}`;
    if (highlight) {
      process.stdout.write(`\x1b[7m${line}\x1b[0m\n`); // Inverted colors
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  // Move cursor back up
  process.stdout.write(`\x1b[${suggestions.length + 1}A`);
  // Move to end of current input
  process.stdout.write(`\x1b[${promptLength}G`);
}

// Clear suggestions from screen
function clearSuggestions(count: number): void {
  if (count === 0) return;

  // Save cursor position
  process.stdout.write('\x1b[s');
  // Move down and clear each line
  for (let i = 0; i < count + 1; i++) {
    process.stdout.write('\n\x1b[2K');
  }
  // Restore cursor position
  process.stdout.write('\x1b[u');
}

// Main interactive loop with autocomplete
export async function startInteractive(options?: InteractiveOptions): Promise<void> {
  let currentInput = '';
  let suggestions: Array<{ name: string; description: string }> = [];
  let selectedIndex = 0;
  let showingSuggestions = false;

  // Print initial hint
  console.log(dim('Type / for commands, or enter a task'));
  console.log('');

  // Show prompt
  const printPrompt = (): void => {
    const session = getSession();
    const prompt = getPrompt(session);
    process.stdout.write(prompt + currentInput);
  };

  // Enable raw mode for key-by-key input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  printPrompt();

  const handleKey = async (key: string): Promise<void> => {
    const session = getSession();
    const prompt = getPrompt(session);
    const promptLen = prompt.length + currentInput.length;

    // Ctrl+C - exit
    if (key === '\x03') {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write('\n');
      options?.onExit?.();
      return;
    }

    // Escape - close suggestions or clear input
    if (key === '\x1b' && showingSuggestions) {
      clearSuggestions(suggestions.length);
      showingSuggestions = false;
      suggestions = [];
      selectedIndex = 0;
      return;
    }

    // Up arrow - navigate suggestions
    if (key === '\x1b[A' && showingSuggestions) {
      selectedIndex = Math.max(0, selectedIndex - 1);
      clearSuggestions(suggestions.length);
      renderSuggestions(suggestions, selectedIndex, promptLen);
      return;
    }

    // Down arrow - navigate suggestions
    if (key === '\x1b[B' && showingSuggestions) {
      selectedIndex = Math.min(suggestions.length - 1, selectedIndex + 1);
      clearSuggestions(suggestions.length);
      renderSuggestions(suggestions, selectedIndex, promptLen);
      return;
    }

    // Tab - autocomplete if showing suggestions
    if (key === '\t' && showingSuggestions && suggestions.length > 0) {
      clearSuggestions(suggestions.length);
      currentInput = '/' + suggestions[selectedIndex].name + ' ';
      showingSuggestions = false;
      suggestions = [];
      selectedIndex = 0;
      // Reprint line
      process.stdout.write('\r\x1b[2K');
      printPrompt();
      return;
    }

    // Enter - submit or select suggestion
    if (key === '\r' || key === '\n') {
      if (showingSuggestions && suggestions.length > 0) {
        // Select suggestion
        clearSuggestions(suggestions.length);
        currentInput = '/' + suggestions[selectedIndex].name;
        showingSuggestions = false;
        suggestions = [];
        selectedIndex = 0;
        // Reprint line
        process.stdout.write('\r\x1b[2K');
        printPrompt();
        return;
      }

      // Submit input
      clearSuggestions(suggestions.length);
      process.stdout.write('\n');

      const input = currentInput.trim();
      currentInput = '';
      showingSuggestions = false;
      suggestions = [];
      selectedIndex = 0;

      // Handle exit
      if (input === 'exit' || input === 'quit' || input === ':q' || input === '/exit') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        options?.onExit?.();
        return;
      }

      // Process input
      if (input) {
        try {
          await orchestrate(input);
        } catch (e) {
          // Swallow errors
        }
      }

      // Show prompt again
      console.log('');
      printPrompt();
      return;
    }

    // Backspace
    if (key === '\x7f' || key === '\b') {
      if (currentInput.length > 0) {
        currentInput = currentInput.slice(0, -1);
        process.stdout.write('\b \b');

        // Update suggestions
        if (currentInput.startsWith('/')) {
          clearSuggestions(suggestions.length);
          suggestions = getFilteredCommands(currentInput);
          selectedIndex = 0;
          if (suggestions.length > 0) {
            showingSuggestions = true;
            const newPromptLen = prompt.length + currentInput.length;
            renderSuggestions(suggestions, selectedIndex, newPromptLen);
          } else {
            showingSuggestions = false;
          }
        } else {
          if (showingSuggestions) {
            clearSuggestions(suggestions.length);
            showingSuggestions = false;
            suggestions = [];
          }
        }
      }
      return;
    }

    // Regular character input
    if (key.length === 1 && key >= ' ') {
      currentInput += key;
      process.stdout.write(key);

      // Check if typing slash command
      if (currentInput.startsWith('/')) {
        clearSuggestions(suggestions.length);
        suggestions = getFilteredCommands(currentInput);
        selectedIndex = 0;
        if (suggestions.length > 0) {
          showingSuggestions = true;
          const newPromptLen = prompt.length + currentInput.length;
          renderSuggestions(suggestions, selectedIndex, newPromptLen);
        } else {
          showingSuggestions = false;
        }
      }
    }
  };

  process.stdin.on('data', handleKey);

  // Handle SIGINT
  process.on('SIGINT', () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write('\n');
    options?.onExit?.();
  });

  return new Promise(() => { });
}
