import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { hasValidCredentials, getApiKey } from './auth';
import { getSession } from './session';
import { loadConfig } from './config';
import { getModel, loadSettings } from './settings';

export interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const session = getSession();

  // Check 1: Node.js version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  results.push({
    name: 'Node.js Version',
    status: major >= 18 ? 'pass' : 'fail',
    message: nodeVersion,
    details: major < 18 ? 'Requires Node.js 18 or higher' : undefined,
  });

  // Check 2: API key configured
  const hasKey = await hasValidCredentials();
  results.push({
    name: 'API Key',
    status: hasKey ? 'pass' : 'fail',
    message: hasKey ? 'Configured' : 'Not configured',
    details: hasKey ? undefined : 'Run "zcode auth" to configure',
  });

  // Check 3: Config directory
  const configDir = path.join(os.homedir(), '.zai');
  const configExists = fs.existsSync(configDir);
  results.push({
    name: 'Config Directory',
    status: configExists ? 'pass' : 'warn',
    message: configExists ? 'Exists' : 'Missing',
    details: configExists ? configDir : 'Will be created on first use',
  });

  // Check 4: Working directory writable
  let writable = false;
  try {
    const testFile = path.join(session.workingDirectory, '.zai-test-' + Date.now());
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    writable = true;
  } catch {
    writable = false;
  }
  results.push({
    name: 'Workspace Writable',
    status: writable ? 'pass' : 'fail',
    message: writable ? 'Yes' : 'No',
    details: writable ? session.workingDirectory : 'Cannot write to workspace',
  });

  // Check 5: Git available
  let gitVersion = '';
  try {
    const { execSync } = require('child_process');
    gitVersion = execSync('git --version', { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch {
    gitVersion = '';
  }
  results.push({
    name: 'Git',
    status: gitVersion ? 'pass' : 'warn',
    message: gitVersion || 'Not found',
    details: gitVersion ? undefined : 'Git is recommended for version control',
  });

  // Check 6: Current model
  const model = getModel();
  results.push({
    name: 'Model',
    status: 'pass',
    message: model,
  });

  // Check 7: Settings file
  const settingsPath = path.join(os.homedir(), '.zai', 'settings.json');
  const settingsExist = fs.existsSync(settingsPath);
  results.push({
    name: 'Settings',
    status: settingsExist ? 'pass' : 'warn',
    message: settingsExist ? 'Found' : 'Using defaults',
  });

  // Check 8: Network connectivity
  let networkOk = false;
  try {
    const https = require('https');
    await new Promise<void>((resolve, reject) => {
      const req = https.get('https://api.z.ai', { timeout: 5000 }, (res: any) => {
        networkOk = res.statusCode < 500;
        resolve();
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
    });
  } catch {
    networkOk = false;
  }
  results.push({
    name: 'Network',
    status: networkOk ? 'pass' : 'warn',
    message: networkOk ? 'Connected' : 'Cannot reach API',
    details: networkOk ? undefined : 'Check internet connection',
  });

  // Check 9: Disk space
  let diskOk = true;
  try {
    const { execSync } = require('child_process');
    if (process.platform !== 'win32') {
      const df = execSync(`df -k "${session.workingDirectory}"`, { encoding: 'utf-8' });
      const lines = df.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        const available = parseInt(parts[3], 10) * 1024; // bytes
        diskOk = available > 100 * 1024 * 1024; // 100MB minimum
      }
    }
  } catch {
    // Ignore
  }
  results.push({
    name: 'Disk Space',
    status: diskOk ? 'pass' : 'warn',
    message: diskOk ? 'OK' : 'Low',
    details: diskOk ? undefined : 'Less than 100MB available',
  });

  return results;
}

export function formatDiagnostics(results: DiagnosticResult[]): string {
  const lines: string[] = ['', 'System Diagnostics', '─'.repeat(40), ''];

  for (const result of results) {
    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '!';
    const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';
    
    lines.push(`${color}${icon}${reset} ${result.name}: ${result.message}`);
    if (result.details) {
      lines.push(`  └─ ${result.details}`);
    }
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  lines.push('');
  lines.push('─'.repeat(40));
  lines.push(`Summary: ${passed} passed, ${warned} warnings, ${failed} failed`);
  
  if (failed > 0) {
    lines.push('\x1b[31mSome checks failed. Please resolve issues above.\x1b[0m');
  } else if (warned > 0) {
    lines.push('\x1b[33mAll critical checks passed with some warnings.\x1b[0m');
  } else {
    lines.push('\x1b[32mAll checks passed!\x1b[0m');
  }

  return lines.join('\n');
}
