export interface DiagnosticResult {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    details?: string;
}
export declare function runDiagnostics(): Promise<DiagnosticResult[]>;
export declare function formatDiagnostics(results: DiagnosticResult[]): string;
//# sourceMappingURL=doctor.d.ts.map