declare module "*.css";

interface Window {
  electron: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    send: (channel: string, data: any) => void;
    on: (channel: string, func: (...args: any[]) => void) => void;
    invoke: (channel: string, data?: any) => Promise<any>;
    getConfig: () => Promise<any>;
    saveConfig: (config: any) => void;
    openWorkspace: () => Promise<any>;
    refreshWorkspace: () => Promise<any>;
    pathExists: (path: string) => Promise<any>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<any>;
    createDirectory: (path: string) => Promise<any>;
    deletePath: (path: string) => Promise<any>;
    applyPatch: (payload: any) => Promise<any>;
    applyDiff: (payload: any) => Promise<any>;
    chat: (messages: any[]) => Promise<any>;
    terminalFeedback: (payload: any) => Promise<any>;
    fetchModels: (payload: any) => Promise<any>;
    sendTerminalInput: (data: string, sessionId?: string | null) => void;
    runProposedCommand: (command: string, sessionId?: string | null) => void;
    onTerminalData: (callback: (data: string) => void) => void;
    generateSpeech: (payload: any) => Promise<any>;
    getPiperVoices: () => Promise<any>;
  };
}
