import { SessionState } from './session';
declare const ASCII_LOGO = "zai\u00B7code";
export declare function renderStartup(projectName: string): string;
export declare function getPrompt(session: SessionState): string;
export declare function renderStatusBar(session: SessionState): string;
export declare function renderStatus(session: SessionState): string;
export declare function getWarnings(session: SessionState): string[];
export declare function success(msg: string): string;
export declare function warning(msg: string): string;
export declare function error(msg: string): string;
export declare function dim(msg: string): string;
export declare function info(msg: string): string;
export declare function hint(action: string): string;
export declare function header(title: string): string;
export declare function box(content: string[], title?: string): string;
export { ASCII_LOGO };
//# sourceMappingURL=ui.d.ts.map