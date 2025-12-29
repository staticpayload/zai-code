import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HISTORY_FILE = path.join(os.homedir(), '.zai', 'history.log');
const MAX_ENTRIES = 100;

export interface HistoryEntry {
  timestamp: string;
  intent: string;
  intentType: string;
  mode: string;
  model: string;
  filesCount: number;
  outcome: 'success' | 'aborted' | 'failed';
}

function ensureHistoryDir(): void {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function logTask(entry: HistoryEntry): void {
  ensureHistoryDir();

  try {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(HISTORY_FILE, line, 'utf-8');

    // Trim if too large
    const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length > MAX_ENTRIES) {
      const trimmed = lines.slice(-MAX_ENTRIES).join('\n') + '\n';
      fs.writeFileSync(HISTORY_FILE, trimmed, 'utf-8');
    }
  } catch {
    // Ignore write errors - history is non-critical
  }
}

export function getHistory(limit?: number): HistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];

    const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.length > 0);
    const entries: HistoryEntry[] = [];
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as HistoryEntry;
        // Validate required fields
        if (parsed && parsed.timestamp && parsed.intent) {
          entries.push(parsed);
        }
      } catch {
        // Skip malformed entries
      }
    }

    const reversed = entries.reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  } catch {
    return [];
  }
}

export function getLastEntry(): HistoryEntry | null {
  const entries = getHistory(1);
  return entries[0] || null;
}

export function clearHistory(): void {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
  } catch {
    // Ignore
  }
}
