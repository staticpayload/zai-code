import * as readline from 'readline';
import { loadSettings, saveSettings, Settings, AVAILABLE_MODELS } from './settings';

// Menu section
interface MenuSection {
  name: string;
  items: MenuItem[];
}

// Menu item types
type MenuItem =
  | { type: 'label'; text: string }
  | { type: 'toggle'; key: string; label: string; values: string[]; getValue: (s: Settings) => string; setValue: (s: Settings, v: string) => void }
  | { type: 'number'; key: string; label: string; min: number; max: number; getValue: (s: Settings) => number; setValue: (s: Settings, v: number) => void }
  | { type: 'select'; key: string; label: string; options: string[]; getValue: (s: Settings) => string; setValue: (s: Settings, v: string) => void }
  | { type: 'action'; key: string; label: string; action: () => boolean };

// Build menu sections
function buildSections(): MenuSection[] {
  return [
    {
      name: 'Model',
      items: [
        { type: 'label', text: 'Select AI model for execution' },
        {
          type: 'select',
          key: 'model',
          label: 'Model',
          options: AVAILABLE_MODELS,
          getValue: (s) => s.model.current,
          setValue: (s, v) => { s.model.current = v; }
        },
      ],
    },
    {
      name: 'UI',
      items: [
        { type: 'toggle', key: 'asciiLogo', label: 'ASCII Logo', values: ['on', 'off'], getValue: (s) => s.ui.asciiLogo, setValue: (s, v) => { s.ui.asciiLogo = v as 'on' | 'off'; } },
        { type: 'toggle', key: 'color', label: 'Color Output', values: ['auto', 'on', 'off'], getValue: (s) => s.ui.color, setValue: (s, v) => { s.ui.color = v as 'auto' | 'on' | 'off'; } },
        { type: 'toggle', key: 'promptStyle', label: 'Prompt Style', values: ['compact', 'verbose'], getValue: (s) => s.ui.promptStyle, setValue: (s, v) => { s.ui.promptStyle = v as 'compact' | 'verbose'; } },
      ],
    },
    {
      name: 'Execution',
      items: [
        { type: 'toggle', key: 'confirmationMode', label: 'Confirmation', values: ['strict', 'normal'], getValue: (s) => s.execution.confirmationMode, setValue: (s, v) => { s.execution.confirmationMode = v as 'strict' | 'normal'; } },
        { type: 'number', key: 'maxPlanIterations', label: 'Max Iterations', min: 1, max: 5, getValue: (s) => s.execution.maxPlanIterations, setValue: (s, v) => { s.execution.maxPlanIterations = v; } },
        { type: 'toggle', key: 'allowShellExec', label: 'Shell Execution', values: ['off', 'on'], getValue: (s) => s.execution.allowShellExec ? 'on' : 'off', setValue: (s, v) => { s.execution.allowShellExec = v === 'on'; } },
      ],
    },
    {
      name: 'Context',
      items: [
        { type: 'toggle', key: 'scope', label: 'Scope', values: ['open', 'touched', 'full'], getValue: (s) => s.context.scope, setValue: (s, v) => { s.context.scope = v as 'open' | 'touched' | 'full'; } },
        { type: 'number', key: 'maxTokens', label: 'Max Tokens', min: 10000, max: 100000, getValue: (s) => s.context.maxTokens, setValue: (s, v) => { s.context.maxTokens = v; } },
      ],
    },
    {
      name: 'Debug',
      items: [
        { type: 'toggle', key: 'logging', label: 'Debug Logging', values: ['off', 'on'], getValue: (s) => s.debug.logging ? 'on' : 'off', setValue: (s, v) => { s.debug.logging = v === 'on'; } },
        { type: 'toggle', key: 'errorDetail', label: 'Error Detail', values: ['brief', 'full'], getValue: (s) => s.debug.errorDetail, setValue: (s, v) => { s.debug.errorDetail = v as 'brief' | 'full'; } },
        { type: 'toggle', key: 'dumpState', label: 'Dump State', values: ['off', 'on'], getValue: (s) => s.debug.dumpState ? 'on' : 'off', setValue: (s, v) => { s.debug.dumpState = v === 'on'; } },
      ],
    },
    {
      name: 'Exit',
      items: [
        { type: 'action', key: 'save', label: 'Save & Exit', action: () => true },
        { type: 'action', key: 'cancel', label: 'Exit Without Saving', action: () => false },
      ],
    },
  ];
}

// Clear screen and move cursor to top
function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

// Render the menu
function render(sections: MenuSection[], sectionIndex: number, itemIndex: number, settings: Settings, warning: string | null): void {
  clearScreen();

  const section = sections[sectionIndex];
  const width = 50;

  // Header
  console.log('┌' + '─'.repeat(width - 2) + '┐');
  console.log('│' + ' Settings'.padEnd(width - 2) + '│');
  console.log('├' + '─'.repeat(width - 2) + '┤');

  // Section tabs
  let tabs = '│ ';
  for (let i = 0; i < sections.length; i++) {
    const name = sections[i].name;
    if (i === sectionIndex) {
      tabs += `[${name}] `;
    } else {
      tabs += `${name} `;
    }
  }
  tabs = tabs.padEnd(width - 1) + '│';
  console.log(tabs);
  console.log('├' + '─'.repeat(width - 2) + '┤');

  // Items
  const items = section.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const selected = i === itemIndex;
    const prefix = selected ? '│ > ' : '│   ';

    let line = '';
    if (item.type === 'label') {
      line = item.text;
    } else if (item.type === 'toggle' || item.type === 'select') {
      const value = item.getValue(settings);
      const values = item.type === 'toggle' ? item.values : item.options;
      const valueStr = values.map(v => v === value ? `[${v}]` : v).join(' ');
      line = `${item.label}: ${valueStr}`;
    } else if (item.type === 'number') {
      const value = item.getValue(settings);
      line = `${item.label}: < ${value} > (${item.min}-${item.max})`;
    } else if (item.type === 'action') {
      line = item.label;
    }

    console.log(prefix + line.padEnd(width - 5) + '│');
  }

  // Padding
  const padding = Math.max(0, 8 - items.length);
  for (let i = 0; i < padding; i++) {
    console.log('│' + ' '.repeat(width - 2) + '│');
  }

  // Warning
  console.log('├' + '─'.repeat(width - 2) + '┤');
  if (warning) {
    console.log('│ ' + warning.substring(0, width - 4).padEnd(width - 3) + '│');
  } else {
    console.log('│' + ' '.repeat(width - 2) + '│');
  }

  // Help
  console.log('├' + '─'.repeat(width - 2) + '┤');
  console.log('│ ↑↓ navigate  ←→ change  Tab section  Esc exit │');
  console.log('└' + '─'.repeat(width - 2) + '┘');
}

// Main menu loop
export async function openSettingsMenu(): Promise<void> {
  const sections = buildSections();
  const originalSettings = JSON.parse(JSON.stringify(loadSettings()));
  let settings = loadSettings();

  let sectionIndex = 0;
  let itemIndex = 0;
  let warning: string | null = null;
  let running = true;
  let shouldSave = false;

  // Setup raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  render(sections, sectionIndex, itemIndex, settings, warning);

  return new Promise((resolve) => {
    const handleKey = (key: string): void => {
      warning = null;
      const section = sections[sectionIndex];
      const items = section.items;
      const item = items[itemIndex];

      // Escape - exit without saving
      if (key === '\x1b' || key === '\x1b\x1b') {
        running = false;
        shouldSave = false;
      }
      // Up arrow
      else if (key === '\x1b[A') {
        itemIndex = Math.max(0, itemIndex - 1);
        // Skip labels
        while (itemIndex > 0 && items[itemIndex].type === 'label') {
          itemIndex--;
        }
      }
      // Down arrow
      else if (key === '\x1b[B') {
        itemIndex = Math.min(items.length - 1, itemIndex + 1);
        // Skip labels
        while (itemIndex < items.length - 1 && items[itemIndex].type === 'label') {
          itemIndex++;
        }
      }
      // Left arrow
      else if (key === '\x1b[D') {
        if (item.type === 'toggle' || item.type === 'select') {
          const values = item.type === 'toggle' ? item.values : item.options;
          const current = item.getValue(settings);
          const idx = values.indexOf(current);
          const newIdx = (idx - 1 + values.length) % values.length;
          item.setValue(settings, values[newIdx]);

          // Warning for full repo scope
          if (item.key === 'scope' && values[newIdx] === 'full') {
            warning = 'Warning: Full repo may be slow';
          }
        } else if (item.type === 'number') {
          const current = item.getValue(settings);
          const step = item.max > 1000 ? 5000 : 1;
          const newVal = Math.max(item.min, current - step);
          item.setValue(settings, newVal);
        }
      }
      // Right arrow
      else if (key === '\x1b[C') {
        if (item.type === 'toggle' || item.type === 'select') {
          const values = item.type === 'toggle' ? item.values : item.options;
          const current = item.getValue(settings);
          const idx = values.indexOf(current);
          const newIdx = (idx + 1) % values.length;
          item.setValue(settings, values[newIdx]);

          if (item.key === 'scope' && values[newIdx] === 'full') {
            warning = 'Warning: Full repo may be slow';
          }
        } else if (item.type === 'number') {
          const current = item.getValue(settings);
          const step = item.max > 1000 ? 5000 : 1;
          const newVal = Math.min(item.max, current + step);
          item.setValue(settings, newVal);
        }
      }
      // Tab - next section
      else if (key === '\t') {
        sectionIndex = (sectionIndex + 1) % sections.length;
        itemIndex = 0;
        // Skip labels
        while (itemIndex < sections[sectionIndex].items.length - 1 && sections[sectionIndex].items[itemIndex].type === 'label') {
          itemIndex++;
        }
      }
      // Shift+Tab - previous section (usually \x1b[Z)
      else if (key === '\x1b[Z') {
        sectionIndex = (sectionIndex - 1 + sections.length) % sections.length;
        itemIndex = 0;
        while (itemIndex < sections[sectionIndex].items.length - 1 && sections[sectionIndex].items[itemIndex].type === 'label') {
          itemIndex++;
        }
      }
      // Enter
      else if (key === '\r' || key === '\n') {
        if (item.type === 'action') {
          shouldSave = item.action();
          running = false;
        }
      }

      if (running) {
        render(sections, sectionIndex, itemIndex, settings, warning);
      } else {
        // Cleanup
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdin.removeListener('data', handleKey);

        clearScreen();

        if (shouldSave) {
          saveSettings(settings);
          console.log('Settings saved.');
        } else {
          // Restore original
          Object.assign(settings, originalSettings);
          console.log('Settings unchanged.');
        }

        resolve();
      }
    };

    process.stdin.on('data', handleKey);
  });
}
