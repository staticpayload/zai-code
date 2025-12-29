import React from 'react';
import { OutputLine } from './OutputArea';
interface AppProps {
    projectName: string;
    workingDirectory: string;
    onCommand: (input: string) => Promise<OutputLine[]>;
    onExit: () => void;
}
export declare const App: React.FC<AppProps>;
export {};
//# sourceMappingURL=App.d.ts.map