import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import '../styles/index.css';

// Component Imports
import { WindowControls } from './components/WindowControls';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { SettingsModal } from './components/SettingsModal';
import { CodeEditor } from './components/CodeEditor';
import { FileNode } from './components/FileTree';
import { TerminalGate } from './components/TerminalGate';
import { Terminal as TerminalIcon, Check, X } from 'lucide-react';
import { SpeechService } from './services/SpeechService';

const App = () => {
  type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'mistral' | 'groq' | 'deepseek' | 'xai' | 'together' | 'perplexity';
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  
  // Config States
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('');
  const [lmStudioUrl, setLmStudioUrl] = useState('http://localhost:1234');
  const [lmStudioModel, setLmStudioModel] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('ollama');
  const [rawConfig, setRawConfig] = useState<any>(null);
  const [autoDiscovery, setAutoDiscovery] = useState(true);
  const [brightness, setBrightness] = useState(1.0);
  const [jailbreak, setJailbreak] = useState(false);
  
  // Piper TTS States
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<'piper' | 'system'>('piper');
  const [language, setLanguage] = useState('en_US');
  const [voice, setVoice] = useState('en_US-ryan-medium');
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  
  const [workspace, setWorkspace] = useState<{ path: string, tree: FileNode[] } | null>(null);
  const [syncPrompt, setSyncPrompt] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isSavingFile, setIsSavingFile] = useState(false);
  
  // Diff States
  const [diffMode, setDiffMode] = useState(false);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [modifiedContent, setModifiedContent] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<any | null>(null);

  const [proposedCommand, setProposedCommand] = useState<string | null>(null);
  const [lastTerminalOutput, setLastTerminalOutput] = useState<string | null>(null);
  const knownFilesRef = useRef<Set<string>>(new Set());

  const [chatWidth, setChatWidth] = useState(320);
  const isResizing = useRef(false);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 240 && newWidth < (window.innerWidth - 400)) {
       setChatWidth(newWidth);
    }
  }, []);

  const refreshWorkspace = async () => {
    const updated = await (window as any).electron.invoke('refresh-workspace');
    if (updated) setWorkspace(updated);
  };

  const rememberFile = (filePath: string) => {
    knownFilesRef.current.add(filePath);
  };

  const forgetFile = (filePath: string) => {
    knownFilesRef.current.delete(filePath);
  };

  const ensureFileReadBeforeEdit = async (filePath: string): Promise<string | null> => {
    if (knownFilesRef.current.has(filePath)) {
      return null;
    }

    const existing = await window.electron.pathExists(filePath);
    if (!existing?.exists || existing?.isDirectory) {
      return null;
    }

    const content = await window.electron.readFile(filePath);
    if (typeof content === 'string') {
      rememberFile(filePath);
      setActiveFile(filePath);
      setFileContent(content);
      return `[READ REQUIRED BEFORE EDIT: ${filePath}]\n${content}\n\nPlease read the file first, then propose the edit again with an exact diff.`;
    }

    return `[READ FAILED BEFORE EDIT: ${filePath}]`;
  };

  const applyLineOperations = (content: string, operations: any[]): string => {
    const lines = content.replace(/\r\n/g, '\n').split('\n');

    for (const operation of operations) {
      if (operation.type === 'append') {
        const appendText = operation.content || '';
        if (appendText.trim() && lines.join('\n').trimEnd().endsWith(appendText.trim())) {
          continue;
        }
        const appendLines = appendText.replace(/\r\n/g, '\n').split('\n');
        if (lines.length === 1 && lines[0] === '') {
          lines.splice(0, 1, ...appendLines);
        } else {
          lines.push(...appendLines);
        }
        continue;
      }

      const index = Math.max(0, (operation.position || 1) - 1);
      if (operation.type === 'add_line') {
        lines.splice(index, 0, ...(operation.content || '').replace(/\r\n/g, '\n').split('\n'));
      } else if (operation.type === 'replace_line') {
        lines.splice(index, 1, ...(operation.content || '').replace(/\r\n/g, '\n').split('\n'));
      } else if (operation.type === 'remove_line') {
        if (index < lines.length) lines.splice(index, 1);
      }
    }

    return lines.join('\n');
  };

  useEffect(() => {
    const loadData = async () => {
      const config = await (window as any).electron.invoke('get-config');
      if (config) {
        setRawConfig(config);
        setOllamaUrl(config.ollamaUrl || 'http://localhost:11434');
        setOllamaModel(config.ollamaModel || '');
        setLmStudioUrl(config.lmStudioUrl || 'http://localhost:1234');
        setLmStudioModel(config.lmStudioModel || '');
        setSelectedProvider(config.selectedProvider || 'ollama');
        setAutoDiscovery(config.autoDiscovery !== undefined ? config.autoDiscovery : true);
        setJailbreak(config.jailbreak || false);
        setBrightness(config.brightness !== undefined ? config.brightness : 1.0);
        setTtsEnabled(config.ttsEnabled || false);
        setTtsEngine(config.tts_engine || 'piper');
        setLanguage(config.language || 'en_US');
        setVoice(config.voice || 'en_US-ryan-medium');
        setSpeed(config.speed || 1.0);
        setVolume(config.volume || 1.0);
        
        SpeechService.getInstance().updateSettings(
          config.ttsEnabled || false, 
          config.tts_engine || 'piper',
          config.language || 'en_US',
          !config.voice || config.voice === 'en_US-joe-medium' ? 'en_US-ryan-medium' : config.voice,
          config.speed || 1.0,
          config.volume || 1.0
        );
      }
    };
    loadData();
  }, []);

  const handleSaveSettings = (oUrl: string, oMod: string, lUrl: string, lMod: string, prov: ProviderId, bri: number, tts: boolean, engine: 'piper' | 'system', lang: string, vce: string, spd: number, vol: number, discovery: boolean, jail: boolean) => {
    setOllamaUrl(oUrl); setOllamaModel(oMod); setLmStudioUrl(lUrl); setLmStudioModel(lMod); setSelectedProvider(prov); setBrightness(bri); setAutoDiscovery(discovery);
    setJailbreak(jail);
    setTtsEnabled(tts); setTtsEngine(engine); setLanguage(lang); setVoice(vce); setSpeed(spd); setVolume(vol);
    SpeechService.getInstance().updateSettings(tts, engine, lang, vce, spd, vol);
    (window as any).electron.send('save-config', {
      ollamaUrl: oUrl, ollamaModel: oMod, lmStudioUrl: lUrl, lmStudioModel: lMod, selectedProvider: prov, brightness: bri, autoDiscovery: discovery,
      jailbreak: jail,
      ttsEnabled: tts, tts_engine: engine, language: lang, voice: vce, speed: spd, volume: vol
    });
    setShowSettings(false);
  };

  const handleSaveRawConfig = (config: any) => {
    setRawConfig(config);
    setSelectedProvider(config.selectedProvider || 'ollama');
    setOllamaUrl(config.ollamaUrl || config.providers?.ollama?.baseUrl || 'http://localhost:11434');
    setOllamaModel(config.ollamaModel || config.providers?.ollama?.model || '');
    setLmStudioUrl(config.lmStudioUrl || config.providers?.lmstudio?.baseUrl || 'http://localhost:1234');
    setLmStudioModel(config.lmStudioModel || config.providers?.lmstudio?.model || '');
    setBrightness(config.brightness ?? 1.0);
    setAutoDiscovery(config.autoDiscovery ?? true);
    setJailbreak(config.jailbreak || false);
    setTtsEnabled(config.ttsEnabled || false);
    setTtsEngine(config.tts_engine || 'piper');
    setLanguage(config.language || 'en_US');
    setVoice(config.voice || 'en_US-ryan-medium');
    setSpeed(config.speed || 1.0);
    setVolume(config.volume || 1.0);
    SpeechService.getInstance().updateSettings(
      config.ttsEnabled || false,
      config.tts_engine || 'piper',
      config.language || 'en_US',
      config.voice || 'en_US-ryan-medium',
      config.speed || 1.0,
      config.volume || 1.0
    );
    window.electron.saveConfig(config);
    setShowSettings(false);
  };

  const handleOpenWorkspace = async () => {
    const ws = await (window as any).electron.invoke('open-workspace');
    if (ws) {
      setWorkspace(ws);
      setSyncPrompt("I haven't mapped your workspace yet. Would you like me to analyze the project structure now?");
      (window as any).electron.send('set-terminal-cwd', { sessionId: activeSessionId, dir: ws.path });
    }
  };

  const handleFileClick = async (path: string) => {
    setActiveFile(path);
    setFileContent(null);
    setDiffMode(false);
    try {
      const content = await (window as any).electron.invoke('read-file', path);
      if (typeof content === 'string') {
        rememberFile(path);
        setFileContent(content);
      }
    } catch (e) {
      setFileContent(`// FATAL ERROR: Failed to read file ${path}\n// ${e}`);
    }
  };

  const handleSaveFile = async (content: string) => {
    if (!activeFile) return;

    setIsSavingFile(true);
    setFileContent(content);

    try {
      const result = await window.electron.writeFile(activeFile, content);
      if (!result?.success) {
        throw new Error(result?.error || 'Unknown write failure');
      }
    } catch (error) {
      alert(`Save failed for ${activeFile}\n${error}`);
    } finally {
      setIsSavingFile(false);
    }
  };

  const inferWriteIntent = (message?: string | null) => {
    const text = (message || '').toLowerCase();
    return {
      append: /\b(add|append|insert|few more lines|more lines|add lines|add code|append code|put more)\b/.test(text),
      removePartial: /\b(remove|delete)\b/.test(text) && /\b(line|part|piece|block|code)\b/.test(text),
      replaceWhole: /\b(replace the whole file|overwrite the file|rewrite the file|replace entire file)\b/.test(text),
    };
  };

  const handleToolCall = async (tools: any[], context?: { lastUserMessage?: string | null }): Promise<string | null> => {
    let toolResults = "";
    const intent = inferWriteIntent(context?.lastUserMessage);

    for (const tool of tools) {
      if (tool.type === 'terminal') {
        setProposedCommand(tool.payload);
      } else if (tool.type === 'read_file') {
        const content = await (window as any).electron.invoke('read-file', tool.payload);
        if (typeof content === 'string') {
          rememberFile(tool.payload);
          setActiveFile(tool.payload);
          setFileContent(content);
          toolResults += `[FILE CONTENT: ${tool.payload}]\n${content}\n\n`;
        } else {
          toolResults += `[ERROR READING: ${tool.payload}]\n${content.error}\n\n`;
        }
      } else if (tool.type === 'create_directory') {
        const res = await window.electron.createDirectory(tool.payload);
        if (res.success) {
          toolResults += `[DIRECTORY CREATED: ${tool.payload}]\n`;
          await refreshWorkspace();
        } else {
          toolResults += `[DIRECTORY CREATE ERROR: ${tool.payload}]\n${res.error}\n\n`;
        }
      } else if (tool.type === 'delete_path') {
        const res = await window.electron.deletePath(tool.payload);
        if (res.success) {
          forgetFile(tool.payload);
          toolResults += `[PATH DELETED: ${tool.payload}]\n`;
          await refreshWorkspace();
          if (activeFile === tool.payload) {
            setActiveFile(null);
            setFileContent(null);
          }
        } else {
          toolResults += `[DELETE ERROR: ${tool.payload}]\n${res.error}\n\n`;
        }
      } else if (tool.type === 'list_files') {
        const ws = await (window as any).electron.invoke('refresh-workspace');
        if (ws && ws.tree) {
          const list = ws.tree.map((n: any) => n.isDirectory ? `DIR: ${n.name}` : `FILE: ${n.name}`).join('\n');
          toolResults += `[DIRECTORY LISTING]\n${list}\n\n`;
        }
      } else if (tool.type === 'write_file') {
        const existing = await window.electron.pathExists(tool.payload.path);
        if (existing?.exists && !knownFilesRef.current.has(tool.payload.path) && !jailbreak) {
          const guardResult = await ensureFileReadBeforeEdit(tool.payload.path);
          if (guardResult) {
            toolResults += `${guardResult}\n\n`;
            continue;
          }
        }

        if (existing?.exists && !intent.replaceWhole && !jailbreak) {
          const currentContent = await window.electron.readFile(tool.payload.path);
          const currentText = typeof currentContent === 'string' ? currentContent : '';
          const incomingText = typeof tool.payload.content === 'string' ? tool.payload.content : '';
          const currentTrimmed = currentText.trim();
          const incomingTrimmed = incomingText.trim();

          if (intent.append && currentTrimmed.length > 0 && !incomingText.includes(currentTrimmed)) {
            const appended = currentText.endsWith('\n') || currentText.length === 0
              ? `${currentText}${incomingText.replace(/^\n+/, '')}`
              : `${currentText}\n${incomingText.replace(/^\n+/, '')}`;
            setActiveFile(tool.payload.path);
            setOriginalContent(currentText);
            setModifiedContent(appended);
            setPendingChanges({ type: 'write_file_replace', path: tool.payload.path, content: appended });
            setDiffMode(true);
            toolResults += `[APPEND PREVIEW PREPARED: ${tool.payload.path}]\n`;
            continue;
          }

          const preservesExistingContent = currentTrimmed.length === 0 || incomingText.includes(currentTrimmed);
          if (!intent.replaceWhole && incomingTrimmed.length > 0 && incomingText !== currentText && !preservesExistingContent && !jailbreak) {
            toolResults += `[WRITE BLOCKED FOR EXISTING FILE: ${tool.payload.path}]\nExisting files should be edited with diff-style changes, not replaced wholesale.\n\n`;
            continue;
          }
        }

        const res = await (window as any).electron.invoke('write-file', { path: tool.payload.path, content: tool.payload.content });
        if (res.success) {
           rememberFile(tool.payload.path);
           toolResults += `[SUCCESSFULLY WRITTEN: ${tool.payload.path}]\n`;
           await refreshWorkspace();
           if (activeFile && tool.payload.path === activeFile) {
              setFileContent(tool.payload.content);
           }
        } else {
           toolResults += `[WRITE ERROR: ${tool.payload.path}]\n${res.error}\n\n`;
        }
      } else if (tool.type === 'patch') {
        const guardResult = await ensureFileReadBeforeEdit(tool.payload.path);
        if (guardResult) {
          toolResults += `${guardResult}\n\n`;
          continue;
        }

        const currentContent = await (window as any).electron.invoke('read-file', tool.payload.path);
        const contentStr = (typeof currentContent === 'string') ? currentContent : '';
        const base = contentStr.endsWith('\n') ? contentStr : (contentStr ? contentStr + '\n' : '');
        
        setActiveFile(tool.payload.path);
        setOriginalContent(contentStr);
        setModifiedContent(base + tool.payload.content);
        setPendingChanges({ type: 'patch', ...tool.payload });
        setDiffMode(true);
      } else if (tool.type === 'diff') {
        const guardResult = await ensureFileReadBeforeEdit(tool.payload.path);
        if (guardResult) {
          toolResults += `${guardResult}\n\n`;
          continue;
        }

        const currentContent = await (window as any).electron.invoke('read-file', tool.payload.path);
        const contentStr = (typeof currentContent === 'string') ? currentContent : '';
        
        let modified = contentStr;
        for (const change of tool.payload.changes) {
          const searchSource = typeof change.search === 'string' ? change.search : '';
          const replaceSource = typeof change.replace === 'string' ? change.replace : '';
          if (searchSource.trim() === '[EMPTY]' || searchSource === '') {
            if (replaceSource.trim() && modified.trimEnd().endsWith(replaceSource.trim())) {
              continue;
            }
            modified = modified.endsWith('\n') || modified.length === 0
              ? `${modified}${replaceSource}`
              : `${modified}\n${replaceSource}`;
            continue;
          }

          const norm = modified.replace(/\r\n/g, '\n');
          const searchNorm = searchSource.replace(/\r\n/g, '\n');
          if (norm.includes(searchNorm)) {
            modified = norm.replace(searchNorm, replaceSource.replace(/\r\n/g, '\n'));
          }
        }
        
        setActiveFile(tool.payload.path);
        setOriginalContent(contentStr);
        setModifiedContent(modified);
        setPendingChanges({ type: 'diff', ...tool.payload });
        setDiffMode(true);
      } else if (tool.type === 'edit_file_ops') {
        const guardResult = await ensureFileReadBeforeEdit(tool.payload.path);
        if (guardResult) {
          toolResults += `${guardResult}\n\n`;
          continue;
        }

        const currentContent = await window.electron.readFile(tool.payload.path);
        const contentStr = typeof currentContent === 'string' ? currentContent : '';
        const modified = applyLineOperations(contentStr, tool.payload.operations || []);

        setActiveFile(tool.payload.path);
        setOriginalContent(contentStr);
        setModifiedContent(modified);
        setPendingChanges({ type: 'edit_file_ops', ...tool.payload });
        setDiffMode(true);
      }
    }

    return toolResults || null;
  };

  const handleAcceptDiff = async () => {
    if (!pendingChanges) return;
    const res = pendingChanges.type === 'patch'
      ? await window.electron.applyPatch(pendingChanges)
      : pendingChanges.type === 'edit_file_ops'
        ? await window.electron.writeFile(pendingChanges.path, modifiedContent || '')
        : pendingChanges.type === 'write_file_replace'
          ? await window.electron.writeFile(pendingChanges.path, pendingChanges.content || '')
        : await window.electron.applyDiff(pendingChanges);
    if (res.success) {
      if (activeFile) rememberFile(activeFile);
      setFileContent(res.updatedContent);
      setDiffMode(false);
      setPendingChanges(null);
      setOriginalContent(null);
      setModifiedContent(null);
      await refreshWorkspace();
    } else {
      alert(`Edit Failed: ${res.error}`);
    }
  };

  const handleCreateItem = async (name: string) => {
    if (!workspace || !name) { return; }
    if (newItemType === 'file') await (window as any).electron.invoke('write-file', { path: name, content: "" });
    else await (window as any).electron.invoke('create-directory', name);
    if (newItemType === 'file') rememberFile(name);
    setNewItemType(null);
    await refreshWorkspace();
  };

  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-screen bg-[#050506] text-zinc-300 font-sans overflow-hidden transition-all duration-300" style={{ filter: `brightness(${brightness})` }}>
      <WindowControls />

      <AnimatePresence mode="wait">
        <Sidebar 
          isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} 
          onOpenSettings={() => setShowSettings(true)} 
          workspace={workspace} onOpenWorkspace={handleOpenWorkspace} onFileClick={handleFileClick}
          onNewItem={(type) => setNewItemType(type)} newItemType={newItemType} onCreateItem={handleCreateItem}
        />
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative bg-[#050506] min-w-0 border-x border-white/5">
        <div className="flex-1 flex flex-col min-h-0 relative">
          <CodeEditor 
            path={activeFile} 
            content={fileContent} 
            onChange={(c) => setFileContent(c)}
            onSaveRequest={handleSaveFile}
            diffMode={diffMode}
            originalContent={originalContent}
            modifiedContent={modifiedContent}
          />
          
          <AnimatePresence>
            {diffMode && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#0a0a0b] border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl z-[100]"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI PROPOSED CHANGES</span>
                <div className="w-[1px] h-4 bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setDiffMode(false); setPendingChanges(null); setOriginalContent(null); setModifiedContent(null); }}
                    className="px-4 py-1.5 border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Decline
                  </button>
                  <button onClick={handleAcceptDiff} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"><Check size={14} /> Apply</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="h-8 bg-[#050506] border-t border-white/5 flex items-center px-6 justify-between shrink-0">
           <div className="flex items-center gap-3">
              <div className={`w-1 h-1 rounded-full ${selectedProvider === 'ollama' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
              <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">
                {isSavingFile ? 'saving file...' : `${selectedProvider} online`}
              </span>
           </div>
           <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className={`p-1 hover:text-white transition-colors ${isTerminalOpen ? 'text-indigo-400' : 'text-zinc-700'}`}><TerminalIcon size={12} /></button>
        </div>

        <TerminalGate 
          sessionId={activeSessionId}
          proposedCommand={proposedCommand} 
          onAccept={(cmd) => { (window as any).electron.send('run-proposed-command', { sessionId: activeSessionId, command: cmd }); setProposedCommand(null); setIsTerminalOpen(true); }} 
          onDecline={() => setProposedCommand(null)} 
          onOutput={(out) => { setLastTerminalOutput(out); setTimeout(() => setLastTerminalOutput(null), 100); }}
          isOpen={isTerminalOpen} 
        />
      </div>

      <div onMouseDown={startResizing} className="w-[2px] h-full bg-white/5 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-[100] active:bg-indigo-500"></div>

      <div style={{ width: chatWidth }} className="shrink-0 h-full bg-[#050506]">
        <ChatPanel 
          onToolCall={handleToolCall} 
          syncPrompt={syncPrompt} 
          onSyncDone={() => setSyncPrompt(null)} 
          ttsEnabled={ttsEnabled} 
          terminalOutput={lastTerminalOutput} 
          onSessionChange={(sid) => {
            setActiveSessionId(sid);
            if (workspace) (window as any).electron.send('set-terminal-cwd', { sessionId: sid, dir: workspace.path });
          }}
        />
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal 
            onClose={() => setShowSettings(false)} onSave={handleSaveSettings}
            onSaveRawConfig={handleSaveRawConfig}
            initialConfig={rawConfig}
            initialOllama={ollamaUrl} initialOllamaModel={ollamaModel} initialLm={lmStudioUrl} initialLmModel={lmStudioModel} initialProvider={selectedProvider} initialBrightness={brightness}
            initialTtsEnabled={ttsEnabled} initialEngine={ttsEngine} initialLanguage={language} initialVoice={voice} initialSpeed={speed} initialVolume={volume} initialDiscovery={autoDiscovery} initialJailbreak={jailbreak}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
