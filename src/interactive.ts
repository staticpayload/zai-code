import * as readline from 'readline';
import { orchestrate } from './orchestrator';
import { getSession } from './session';
import { getPrompt } from './ui';

export interface InteractiveOptions {
  prompt?: string;
  onExit?: () => void;
}

export async function startInteractive(options?: InteractiveOptions): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): void => {
    const session = getSession();
    const currentPrompt = getPrompt(session);

    rl.question(currentPrompt, async (input) => {
      const trimmed = input.trim();

      // Exit commands (handled before orchestrator for immediate response)
      if (trimmed === 'exit' || trimmed === 'quit' || trimmed === ':q') {
        rl.close();
        options?.onExit?.();
        return;
      }

      // Empty input - just re-prompt
      if (!trimmed) {
        askQuestion();
        return;
      }

      // Route ALL input through orchestrator
      try {
        await orchestrate(trimmed);
      } catch (error) {
        // Swallow errors, continue loop
      }

      // Continue loop
      askQuestion();
    });
  };

  // Handle Ctrl+C gracefully
  rl.on('close', () => {
    options?.onExit?.();
  });

  process.on('SIGINT', () => {
    rl.close();
  });

  askQuestion();

  return new Promise(() => {});
}
