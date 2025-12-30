// ============================================================================
// ZCODE OUTPUT THEMING - Cosmic Orange
// ============================================================================

import { shouldShowColor } from './settings';

// ANSI color codes - Cosmic Orange palette
function getColors() {
  const enabled = shouldShowColor();
  return {
    reset: enabled ? '\x1b[0m' : '',
    dim: enabled ? '\x1b[2m' : '',
    bold: enabled ? '\x1b[1m' : '',
    italic: enabled ? '\x1b[3m' : '',
    underline: enabled ? '\x1b[4m' : '',
    // Foreground - Cosmic Orange palette
    black: enabled ? '\x1b[30m' : '',
    red: enabled ? '\x1b[31m' : '',
    green: enabled ? '\x1b[32m' : '',
    yellow: enabled ? '\x1b[33m' : '',
    blue: enabled ? '\x1b[34m' : '',
    magenta: enabled ? '\x1b[35m' : '',
    cyan: enabled ? '\x1b[36m' : '',
    white: enabled ? '\x1b[37m' : '',
    gray: enabled ? '\x1b[90m' : '',
    // Bright - Orange tones (using 256 color)
    orange: enabled ? '\x1b[38;5;208m' : '',      // Main orange
    brightOrange: enabled ? '\x1b[38;5;214m' : '', // Bright orange
    deepOrange: enabled ? '\x1b[38;5;202m' : '',   // Deep orange
    gold: enabled ? '\x1b[38;5;220m' : '',         // Gold accent
    coral: enabled ? '\x1b[38;5;209m' : '',        // Coral
    peach: enabled ? '\x1b[38;5;216m' : '',        // Soft peach
    rust: enabled ? '\x1b[38;5;166m' : '',         // Rust
    // Cosmic accents
    purple: enabled ? '\x1b[38;5;135m' : '',       // Cosmic purple
    pink: enabled ? '\x1b[38;5;212m' : '',         // Cosmic pink
    // Bright foreground
    brightRed: enabled ? '\x1b[91m' : '',
    brightGreen: enabled ? '\x1b[92m' : '',
    brightYellow: enabled ? '\x1b[93m' : '',
    brightBlue: enabled ? '\x1b[94m' : '',
    brightMagenta: enabled ? '\x1b[95m' : '',
    brightCyan: enabled ? '\x1b[96m' : '',
    // Background
    bgBlack: enabled ? '\x1b[40m' : '',
    bgRed: enabled ? '\x1b[41m' : '',
    bgGreen: enabled ? '\x1b[42m' : '',
    bgYellow: enabled ? '\x1b[43m' : '',
    bgBlue: enabled ? '\x1b[44m' : '',
    bgMagenta: enabled ? '\x1b[45m' : '',
    bgCyan: enabled ? '\x1b[46m' : '',
    bgGray: enabled ? '\x1b[100m' : '',
    bgOrange: enabled ? '\x1b[48;5;208m' : '',
  };
}

const c = () => getColors();

// ============================================================================
// ACTION ICONS - ASCII symbols for different operations
// ============================================================================

export const icons = {
  // Status
  success: '✓',
  error: '✗',
  warning: '!',
  info: '·',
  pending: '○',
  active: '●',
  
  // Actions
  thinking: '◐',
  reading: '>',
  writing: '+',
  modifying: '~',
  deleting: '-',
  searching: '/',
  
  // Flow
  arrow: '→',
  arrowDown: '↓',
  arrowUp: '↑',
  bullet: '•',
  dash: '─',
  pipe: '│',
  corner: '└',
  tee: '├',
  
  // Progress
  spinnerFrames: ['◐', '◓', '◑', '◒'],
  progressFull: '█',
  progressEmpty: '░',
  progressHalf: '▓',
};

// ============================================================================
// FORMATTED OUTPUT FUNCTIONS
// ============================================================================

// Action line with icon - main output format
export function action(icon: string, label: string, detail?: string): string {
  const colors = c();
  const detailStr = detail ? ` ${colors.dim}${detail}${colors.reset}` : '';
  return `${colors.orange}${icon}${colors.reset} ${colors.bold}${label}${colors.reset}${detailStr}`;
}

// Thinking/processing indicator
export function thinking(message: string = 'Thinking'): string {
  const colors = c();
  return `${colors.orange}${icons.thinking}${colors.reset} ${colors.dim}${message}...${colors.reset}`;
}

// Reading file indicator
export function reading(filePath: string): string {
  const colors = c();
  return `${colors.gray}${icons.reading}${colors.reset} ${colors.dim}Reading${colors.reset} ${colors.white}${filePath}${colors.reset}`;
}

// Writing file indicator
export function writing(filePath: string, isNew: boolean = false): string {
  const colors = c();
  const label = isNew ? 'Creating' : 'Writing';
  const icon = isNew ? icons.writing : icons.modifying;
  const color = isNew ? colors.green : colors.gold;
  return `${color}${icon}${colors.reset} ${colors.dim}${label}${colors.reset} ${colors.white}${filePath}${colors.reset}`;
}

// Deleting file indicator
export function deleting(filePath: string): string {
  const colors = c();
  return `${colors.red}${icons.deleting}${colors.reset} ${colors.dim}Deleting${colors.reset} ${colors.white}${filePath}${colors.reset}`;
}

// Success message
export function success(message: string): string {
  const colors = c();
  return `${colors.green}${icons.success}${colors.reset} ${message}`;
}

// Error message
export function error(message: string): string {
  const colors = c();
  return `${colors.red}${icons.error}${colors.reset} ${message}`;
}

// Warning message
export function warning(message: string): string {
  const colors = c();
  return `${colors.gold}${icons.warning}${colors.reset} ${message}`;
}

// Info message (subtle)
export function info(message: string): string {
  const colors = c();
  return `${colors.orange}${icons.info}${colors.reset} ${message}`;
}

// Dim/muted text
export function dim(message: string): string {
  const colors = c();
  return `${colors.dim}${message}${colors.reset}`;
}

// Hint for next action
export function hint(message: string): string {
  const colors = c();
  return `${colors.dim}${icons.arrow} ${message}${colors.reset}`;
}

// ============================================================================
// STRUCTURED OUTPUT - Sections and boxes
// ============================================================================

// Section header with line
export function section(title: string): string {
  const colors = c();
  return `\n${colors.bold}${colors.orange}${title}${colors.reset}`;
}

// Subsection with bullet
export function subsection(title: string): string {
  const colors = c();
  return `${colors.dim}${icons.bullet}${colors.reset} ${colors.bold}${title}${colors.reset}`;
}

// Indented item (for lists)
export function item(text: string, indent: number = 1): string {
  const colors = c();
  const pad = '  '.repeat(indent);
  return `${pad}${colors.dim}${icons.tee}${colors.reset} ${text}`;
}

// Last item in a list
export function lastItem(text: string, indent: number = 1): string {
  const colors = c();
  const pad = '  '.repeat(indent);
  return `${pad}${colors.dim}${icons.corner}${colors.reset} ${text}`;
}

// Key-value pair
export function keyValue(key: string, value: string): string {
  const colors = c();
  return `${colors.dim}${key}:${colors.reset} ${colors.white}${value}${colors.reset}`;
}

// ============================================================================
// PLAN OUTPUT
// ============================================================================

export function planHeader(stepCount: number): string {
  const colors = c();
  return `${colors.orange}${icons.bullet}${colors.reset} ${colors.bold}Plan${colors.reset} ${colors.dim}(${stepCount} steps)${colors.reset}`;
}

export function planStep(index: number, description: string, status: 'pending' | 'active' | 'done' | 'error' = 'pending'): string {
  const colors = c();
  const statusIcons = {
    pending: `${colors.dim}${icons.pending}${colors.reset}`,
    active: `${colors.orange}${icons.active}${colors.reset}`,
    done: `${colors.green}${icons.success}${colors.reset}`,
    error: `${colors.red}${icons.error}${colors.reset}`,
  };
  const icon = statusIcons[status];
  const num = `${colors.dim}${index}.${colors.reset}`;
  return `  ${icon} ${num} ${description}`;
}

// ============================================================================
// FILE OPERATIONS OUTPUT
// ============================================================================

export function fileOperation(operation: 'create' | 'modify' | 'delete', filePath: string): string {
  const colors = c();
  const ops = {
    create: { icon: icons.writing, color: colors.green, label: 'create' },
    modify: { icon: icons.modifying, color: colors.gold, label: 'modify' },
    delete: { icon: icons.deleting, color: colors.red, label: 'delete' },
  };
  const op = ops[operation];
  return `${op.color}${op.icon}${colors.reset} ${colors.dim}${op.label}${colors.reset} ${filePath}`;
}

export function fileResult(operation: 'create' | 'modify' | 'delete', filePath: string, success: boolean): string {
  const colors = c();
  const icon = success ? `${colors.green}${icons.success}${colors.reset}` : `${colors.red}${icons.error}${colors.reset}`;
  return `  ${icon} ${filePath}`;
}

// ============================================================================
// DIFF OUTPUT
// ============================================================================

export function diffHeader(filePath: string): string {
  const colors = c();
  return `${colors.bold}${colors.cyan}--- ${filePath}${colors.reset}`;
}

export function diffLine(line: string): string {
  const colors = c();
  if (line.startsWith('+')) {
    return `${colors.green}${line}${colors.reset}`;
  } else if (line.startsWith('-')) {
    return `${colors.red}${line}${colors.reset}`;
  } else if (line.startsWith('@')) {
    return `${colors.cyan}${line}${colors.reset}`;
  }
  return `${colors.dim}${line}${colors.reset}`;
}

// ============================================================================
// PROGRESS INDICATORS
// ============================================================================

export function progressBar(current: number, total: number, width: number = 20): string {
  const colors = c();
  const percent = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = icons.progressFull.repeat(filled) + icons.progressEmpty.repeat(empty);
  const pct = Math.round(percent * 100);
  return `${colors.orange}${bar}${colors.reset} ${colors.dim}${pct}%${colors.reset}`;
}

export function spinner(frame: number): string {
  const colors = c();
  const f = icons.spinnerFrames[frame % icons.spinnerFrames.length];
  return `${colors.orange}${f}${colors.reset}`;
}

// ============================================================================
// SUMMARY OUTPUT
// ============================================================================

export function summary(stats: { created?: number; modified?: number; deleted?: number; errors?: number }): string {
  const colors = c();
  const parts: string[] = [];
  
  if (stats.created && stats.created > 0) {
    parts.push(`${colors.green}+${stats.created} created${colors.reset}`);
  }
  if (stats.modified && stats.modified > 0) {
    parts.push(`${colors.gold}~${stats.modified} modified${colors.reset}`);
  }
  if (stats.deleted && stats.deleted > 0) {
    parts.push(`${colors.red}-${stats.deleted} deleted${colors.reset}`);
  }
  if (stats.errors && stats.errors > 0) {
    parts.push(`${colors.red}${stats.errors} errors${colors.reset}`);
  }
  
  if (parts.length === 0) {
    return `${colors.dim}No changes${colors.reset}`;
  }
  
  return parts.join(` ${colors.dim}|${colors.reset} `);
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

// Format AI response text with proper styling for blessed TUI
export function response(text: string): string {
  const colors = c();
  return text
    .split('\n')
    .map(line => {
      // Code blocks - dim them
      if (line.startsWith('```')) {
        return `${colors.dim}${line}${colors.reset}`;
      }
      // Headers (# ## ###) - bold orange
      if (line.match(/^#{1,3}\s/)) {
        return `${colors.bold}${colors.orange}${line.replace(/^#+\s*/, '')}${colors.reset}`;
      }
      // Bullet points - replace with our icon
      if (line.match(/^\s*[-*]\s/)) {
        return line.replace(/^(\s*)([-*])(\s)/, `$1${colors.orange}${icons.bullet}${colors.reset}$3`);
      }
      // Numbered lists - dim the number
      if (line.match(/^\s*\d+\.\s/)) {
        return line.replace(/^(\s*)(\d+\.)(\s)/, `$1${colors.dim}$2${colors.reset}$3`);
      }
      // Inline code `code` - highlight
      if (line.includes('`')) {
        return line.replace(/`([^`]+)`/g, `${colors.gold}$1${colors.reset}`);
      }
      // Bold **text** - make bold
      if (line.includes('**')) {
        return line.replace(/\*\*([^*]+)\*\*/g, `${colors.bold}$1${colors.reset}`);
      }
      return line;
    })
    .join('\n');
}

// Format AI response for blessed TUI (uses blessed tags)
export function responseTui(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // Code blocks
      if (line.startsWith('```')) {
        return `{gray-fg}${line}{/gray-fg}`;
      }
      // Headers - bold with 256 color orange
      if (line.match(/^#{1,3}\s/)) {
        return `{bold}{#ff8700-fg}${line.replace(/^#+\s*/, '')}{/#ff8700-fg}{/bold}`;
      }
      // Bullet points
      if (line.match(/^\s*[-*]\s/)) {
        return line.replace(/^(\s*)([-*])(\s)/, `$1{#ff8700-fg}${icons.bullet}{/#ff8700-fg}$3`);
      }
      // Numbered lists
      if (line.match(/^\s*\d+\.\s/)) {
        return line.replace(/^(\s*)(\d+\.)(\s)/, `$1{gray-fg}$2{/gray-fg}$3`);
      }
      // Inline code - gold/yellow
      if (line.includes('`')) {
        return line.replace(/`([^`]+)`/g, `{#ffaf00-fg}$1{/#ffaf00-fg}`);
      }
      // Bold
      if (line.includes('**')) {
        return line.replace(/\*\*([^*]+)\*\*/g, `{bold}$1{/bold}`);
      }
      return line;
    })
    .join('\n');
}

// ============================================================================
// TASK ANALYSIS OUTPUT
// ============================================================================

export function taskType(type: string, complexity: string): string {
  const colors = c();
  const typeColors: Record<string, string> = {
    chat: colors.gray,
    question: colors.blue,
    simple_edit: colors.green,
    complex_task: colors.magenta,
    debug: colors.red,
    refactor: colors.yellow,
  };
  const color = typeColors[type] || colors.white;
  return `${color}${type}${colors.reset} ${colors.dim}(${complexity})${colors.reset}`;
}

// ============================================================================
// BOX DRAWING
// ============================================================================

export function box(lines: string[], title?: string): string {
  const colors = c();
  const output: string[] = [];
  
  if (title) {
    output.push(`${colors.dim}─${colors.reset} ${colors.bold}${title}${colors.reset} ${colors.dim}─${colors.reset}`);
  }
  
  for (const line of lines) {
    output.push(`  ${line}`);
  }
  
  return output.join('\n');
}

// ============================================================================
// EXPORTS FOR TUI (blessed-compatible tags) - Cosmic Orange
// ============================================================================

export const tuiTags = {
  success: (msg: string) => `{green-fg}${icons.success}{/green-fg} ${msg}`,
  error: (msg: string) => `{red-fg}${icons.error}{/red-fg} ${msg}`,
  warning: (msg: string) => `{#ffaf00-fg}${icons.warning}{/#ffaf00-fg} ${msg}`,
  info: (msg: string) => `{#ff8700-fg}${icons.info}{/#ff8700-fg} ${msg}`,
  dim: (msg: string) => `{gray-fg}${msg}{/gray-fg}`,
  thinking: (msg: string = 'Thinking') => `{#ff8700-fg}${icons.thinking}{/#ff8700-fg} {gray-fg}${msg}...{/gray-fg}`,
  reading: (path: string) => `{gray-fg}${icons.reading}{/gray-fg} {gray-fg}Reading{/gray-fg} ${path}`,
  writing: (path: string) => `{green-fg}${icons.writing}{/green-fg} {gray-fg}Creating{/gray-fg} ${path}`,
  modifying: (path: string) => `{#ffaf00-fg}${icons.modifying}{/#ffaf00-fg} {gray-fg}Modifying{/gray-fg} ${path}`,
  deleting: (path: string) => `{red-fg}${icons.deleting}{/red-fg} {gray-fg}Deleting{/gray-fg} ${path}`,
  hint: (msg: string) => `{gray-fg}${icons.arrow} ${msg}{/gray-fg}`,
  planStep: (i: number, desc: string, done: boolean = false) => {
    const icon = done ? `{green-fg}${icons.success}{/green-fg}` : `{gray-fg}${icons.pending}{/gray-fg}`;
    return `  ${icon} {gray-fg}${i}.{/gray-fg} ${desc}`;
  },
  fileOp: (op: 'create' | 'modify' | 'delete', path: string) => {
    const ops = {
      create: { icon: icons.writing, color: 'green' },
      modify: { icon: icons.modifying, color: '#ffaf00' },
      delete: { icon: icons.deleting, color: 'red' },
    };
    const o = ops[op];
    return `{${o.color}-fg}${o.icon}{/${o.color}-fg} ${path}`;
  },
  fileResult: (path: string, ok: boolean) => {
    const icon = ok ? `{green-fg}${icons.success}{/green-fg}` : `{red-fg}${icons.error}{/red-fg}`;
    return `  ${icon} ${path}`;
  },
  summary: (stats: { created?: number; modified?: number; deleted?: number }) => {
    const parts: string[] = [];
    if (stats.created) parts.push(`{green-fg}+${stats.created}{/green-fg}`);
    if (stats.modified) parts.push(`{#ffaf00-fg}~${stats.modified}{/#ffaf00-fg}`);
    if (stats.deleted) parts.push(`{red-fg}-${stats.deleted}{/red-fg}`);
    return parts.join(' ');
  },
};
