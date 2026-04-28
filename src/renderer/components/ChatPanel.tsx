import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, X, Loader2, Volume2, Square, Plus, History, Trash2 } from 'lucide-react';
import { SpeechService } from '../services/SpeechService';

interface Message {
  role: 'user' | 'assistant' | 'system_consent' | 'system_status' | 'system';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

interface ChatPanelProps {
  onToolCall: (tools: any[], context?: { lastUserMessage?: string | null }) => Promise<string | null>;
  syncPrompt?: string | null;
  onSyncDone?: () => void;
  ttsEnabled: boolean;
  terminalOutput?: string | null;
  onSessionChange?: (sessionId: string) => void;
}

const WELCOME_MSG = "Hello! Welcome to Open Nexus, the elite open-source agentic environment developed by Kapustiack. I am prepared to create, analyze, and manipulate your workspace with full system orchestration at your command.";

export const ChatPanel: React.FC<ChatPanelProps> = ({ onToolCall, syncPrompt, onSyncDone, ttsEnabled, terminalOutput, onSessionChange }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (activeSessionId && onSessionChange) {
      onSessionChange(activeSessionId);
    }
  }, [activeSessionId, onSessionChange]);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState<number | null>(null);
  const [activeSpeechId, setActiveSpeechId] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const handleSendRef = useRef<(text?: string, hiddenContent?: string, depth?: number) => Promise<void>>(async () => { });
  const speech = SpeechService.getInstance();

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const createNewChat = (shouldClose = true) => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [{ role: 'assistant', content: WELCOME_MSG }],
      timestamp: Date.now()
    };

    if (activeSessionId) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages } : s));
    }

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages(newSession.messages);
    if (shouldClose) setShowHistory(false);
  };

  const switchChat = (sessionId: string, shouldClose = true) => {
    if (sessionId === activeSessionId) {
      if (shouldClose) setShowHistory(false);
      return;
    }

    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages } : s));

    const target = sessions.find(s => s.id === sessionId);
    if (target) {
      setMessages(target.messages);
      setActiveSessionId(target.id);
    }
    if (shouldClose) setShowHistory(false);
  };

  const deleteChat = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);

    (window as any).electron.send('close-terminal-session', sessionId);

    if (sessionId === activeSessionId) {
      if (newSessions.length > 0) {
        const target = newSessions[0];
        setMessages(target.messages);
        setActiveSessionId(target.id);
      } else {
        createNewChat(false);
      }
    }
  };

  useEffect(() => {
    if (sessions.length === 0) {
      createNewChat(false);
    }
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (!session) return;

      if (session.messages === messages && session.title !== 'New Chat') return;

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          let title = s.title;
          if (title === 'New Chat' && messages.length > 1) {
            const firstUserMsg = messages.find(m => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
            }
          }
          if (s.messages === messages && s.title === title) return s;
          return { ...s, messages, title };
        }
        return s;
      }));
    }
  }, [messages, activeSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
  }, [messages, syncPrompt]);

  const lastFeedbackRef = useRef<string>("");

  useEffect(() => {
    const removeListener = (window as any).electron.on('terminal-error-detected', ({ sessionId: sid, output }: { sessionId: string, output: string }) => {
      if (sid === activeSessionId && !isLoading && output !== lastFeedbackRef.current) {
        handleTerminalFeedback(`[PROACTIVE ERROR DETECTION]:\n${output}`);
      }
    });
    return () => {
      if (typeof removeListener === 'function') removeListener();
    };
  }, [activeSessionId, isLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = speech.getSpeakingState();
      setActiveSpeechId(state.isSpeaking ? state.messageId : null);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalOutput && terminalOutput !== lastFeedbackRef.current) {
      handleTerminalFeedback(terminalOutput);
    }
  }, [terminalOutput]);

  const processAssistantResponse = useCallback(async (response: any, depth = 0) => {
    const aiMsg: Message = { role: 'assistant', content: response.content };
    const nextMessageIndex = messagesRef.current.length;

    setMessages(prev => {
      const updated = [...prev, aiMsg];
      messagesRef.current = updated;
      return updated;
    });
    speech.speak(aiMsg.content, nextMessageIndex);

    if (response.tools && depth < 5) {
      const lastUserMessage = [...messagesRef.current].reverse().find((message) => message.role === 'user')?.content || null;
      const results = await onToolCall(response.tools, { lastUserMessage });
      if (results) {
        await handleSendRef.current(`[SYSTEM: TOOL_RESULTS]\n${results}`, undefined, depth + 1);
      }
    }
  }, [onToolCall]);

  const handleTerminalFeedback = async (output: string) => {
    if (isLoading || !output) return;
    lastFeedbackRef.current = output;
    setIsLoading(true);

    try {
      const validRoles = ['user', 'assistant', 'system'];
      const history = messagesRef.current
        .filter(m => validRoles.includes(m.role))
        .map(m => ({ role: m.role, content: m.content }));

      const response = await window.electron.terminalFeedback({
        output,
        history
      });
      await processAssistantResponse(response);
    } catch (e) {
      console.error("Feedback loop failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (text?: string, hiddenContent?: string, depth = 0) => {
    const val = text || inputValue;
    if (!val.trim() || (isLoading && !val.startsWith('[SYSTEM'))) return;

    const userMsg: Message = { role: val.startsWith('[SYSTEM') ? 'system' : 'user', content: val };
    const validRoles = ['user', 'assistant', 'system'];
    const chatContext = messagesRef.current
      .filter(m => validRoles.includes(m.role))
      .map(m => ({ role: m.role, content: m.content }));

    chatContext.push({ role: userMsg.role, content: val });
    if (hiddenContent) {
      chatContext.push({ role: 'assistant', content: `[SYSTEM: PROJECT_STRUCTURE_LOADED]\n${hiddenContent}` });
    }

    if (!val.startsWith('[SYSTEM')) {
      setMessages(prev => [...prev, userMsg]);
      setInputValue('');
    }

    setIsLoading(true);

    try {
      const response = await window.electron.chat(chatContext);
      await processAssistantResponse(response, depth);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "System communication failure." }]);
    } finally {
      setIsLoading(false);
    }
  };

  handleSendRef.current = handleSend;

  const handleConsent = async (agreed: boolean) => {
    if (onSyncDone) onSyncDone();

    if (agreed) {
      setScanProgress(0);
      const interval = setInterval(() => {
        setScanProgress(prev => (prev !== null && prev < 90) ? prev + 5 : prev);
      }, 100);

      try {
        const ws = await window.electron.invoke('refresh-workspace');
        clearInterval(interval);
        setScanProgress(100);
        setTimeout(() => setScanProgress(null), 800);

        if (!ws || !ws.tree || ws.tree.length === 0) {
          const msg = "Scan complete. The directory appears to be empty.";
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          speech.speak(msg, messages.length);
          return;
        }

        const pruneTree = (nodes: any[]): string => {
          return nodes.map(n => n.isDirectory ? `DIR: ${n.name}` : `FILE: ${n.name}`).join('\n');
        };

        const structureSummary = pruneTree(ws.tree);
        const okMsg = "Workspace mapped. Context established.";
        setMessages(prev => [...prev, { role: 'assistant', content: okMsg }]);
        speech.speak(okMsg, messages.length);

        handleSend("Synchronize workspace context and provide a brief analysis of the project files.", structureSummary);
      } catch (e) {
        setScanProgress(null);
      }
    } else {
      const noMsg = "Understood. Project structure ignored.";
      setMessages(prev => [...prev, { role: 'assistant', content: noMsg }]);
      speech.speak(noMsg, messages.length);
    }
  };

  const toggleSpeech = (content: string, id: number) => {
    if (activeSpeechId === id) speech.stop();
    else speech.speak(content, id, true);
  };

  return (
    <div className="w-full h-full bg-[#080809] border-l border-white/5 flex flex-col pt-12 overflow-hidden relative">
      {/* Top Controls */}
      <div className="absolute top-4 left-6 flex items-center gap-4 z-40">
        <button
          onClick={() => createNewChat(true)}
          className="p-1.5 text-zinc-600 hover:text-white hover:bg-white/5 rounded-md transition-all group relative"
          title="New Chat"
        >
          <Plus size={16} />
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 text-[9px] text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/5">New Chat</span>
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className={`p-1.5 rounded-md transition-all group relative ${showHistory ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-white hover:bg-white/5'}`}
          title="Chat History"
        >
          <History size={16} />
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 text-[9px] text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/5">History</span>
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto scrollbar-hide space-y-12">
        <AnimatePresence mode="popLayout" initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 group relative">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{msg.role === 'assistant' ? 'Open Nexus' : 'User'}</span>
              </div>
              <div className="text-[12px] leading-relaxed text-zinc-400 font-light whitespace-pre-wrap break-words overflow-hidden">{msg.content}</div>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => toggleSpeech(msg.content, i)}
                  className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-zinc-600 hover:text-indigo-400 uppercase tracking-widest"
                >
                  {activeSpeechId === i ? <Square size={10} fill="currentColor" /> : <Volume2 size={10} />}
                  <span>{activeSpeechId === i ? 'Stop' : 'Read'}</span>
                </button>
              )}
            </motion.div>
          ))}

          {syncPrompt && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0 }}
              className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 overflow-hidden"
            >
              <p className="text-[11px] text-zinc-400 leading-relaxed font-light">{syncPrompt}</p>
              <div className="flex items-center gap-3">
                <button onClick={() => handleConsent(true)} className="flex-1 py-2 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">Yes</button>
                <button onClick={() => handleConsent(false)} className="flex-1 py-2 bg-white/5 text-zinc-500 text-[10px] font-bold uppercase rounded-lg border border-white/5 hover:bg-white/10 transition-all">No</button>
              </div>
              <p className="text-[9px] text-zinc-600 italic">If you click no, AI can still read individual files if you ask it to.</p>
            </motion.div>
          )}

          {scanProgress !== null && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="h-[1px] flex-1 bg-white/5 overflow-hidden">
                <motion.div className="h-full bg-indigo-500/50" initial={{ width: 0 }} animate={{ width: `${scanProgress}%` }} />
              </div>
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">Scanning {scanProgress}%</span>
            </div>
          )}

          {isLoading && (
            <div className="text-zinc-700">
              <span className="text-[9px] uppercase tracking-widest opacity-50">Syncing...</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-6">
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={isLoading}
            placeholder={isLoading ? "Analyzing..." : "Type query..."}
            className="w-full bg-transparent border-t border-white/5 pt-4 text-[12px] focus:outline-none transition-all resize-none h-24 text-zinc-300 placeholder:text-zinc-800 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputValue.trim()}
            className="absolute bottom-0 right-0 p-2 text-zinc-700 hover:text-white transition-colors disabled:opacity-30"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full max-w-[280px] bg-[#0d0d0f] border border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">History</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => createNewChat(true)}
                    className="p-1.5 hover:bg-white/5 rounded-md text-zinc-500 hover:text-indigo-400 transition-all"
                    title="New Session"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1.5 hover:bg-white/5 rounded-md text-zinc-500 hover:text-white transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => switchChat(s.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${s.id === activeSessionId ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1 h-1 rounded-full shrink-0 ${s.id === activeSessionId ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
                      <div className="flex flex-col min-w-0">
                        <span className={`text-[10px] truncate tracking-tight ${s.id === activeSessionId ? 'text-indigo-300' : 'text-zinc-400'}`}>
                          {s.title}
                        </span>
                        <span className="text-[8px] text-zinc-700 mt-0.5 font-mono uppercase">
                          {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteChat(e, s.id)}
                      className="p-1 text-zinc-800 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
