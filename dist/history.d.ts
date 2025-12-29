export interface HistoryEntry {
    timestamp: string;
    intent: string;
    intentType: string;
    mode: string;
    model: string;
    filesCount: number;
    outcome: 'success' | 'aborted' | 'failed';
}
export declare function logTask(entry: HistoryEntry): void;
export declare function getHistory(limit?: number): HistoryEntry[];
export declare function getLastEntry(): HistoryEntry | null;
export declare function clearHistory(): void;
//# sourceMappingURL=history.d.ts.map