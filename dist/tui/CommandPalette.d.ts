import React from 'react';
interface Command {
    name: string;
    description: string;
}
interface CommandPaletteProps {
    commands: Command[];
    filter: string;
    selectedIndex: number;
    onSelect: (command: string) => void;
    onClose: () => void;
    onNavigate: (direction: 'up' | 'down') => void;
    visible: boolean;
}
export declare const CommandPalette: React.FC<CommandPaletteProps>;
export {};
//# sourceMappingURL=CommandPalette.d.ts.map