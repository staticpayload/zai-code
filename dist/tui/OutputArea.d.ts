import React from 'react';
export interface OutputLine {
    type: 'info' | 'success' | 'error' | 'dim' | 'plain';
    text: string;
    timestamp?: number;
}
interface OutputAreaProps {
    lines: OutputLine[];
    maxLines?: number;
}
export declare const OutputArea: React.FC<OutputAreaProps>;
export {};
//# sourceMappingURL=OutputArea.d.ts.map