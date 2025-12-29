export interface GitInfo {
    isRepo: boolean;
    branch: string | null;
    isDirty: boolean;
    uncommittedFiles: number;
    repoName: string | null;
}
export declare function getGitInfo(cwd: string): GitInfo;
export declare function formatGitStatus(info: GitInfo): string;
//# sourceMappingURL=git.d.ts.map