import React from 'react';
interface InputBoxProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (value: string) => void;
    onSlash: () => void;
    placeholder?: string;
    mode?: string;
    state?: string;
}
export declare const InputBox: React.FC<InputBoxProps>;
export {};
//# sourceMappingURL=InputBox.d.ts.map