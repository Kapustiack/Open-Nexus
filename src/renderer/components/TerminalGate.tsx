import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal as TerminalIcon, Play, X, Check, Loader2 } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalGateProps {
  sessionId: string | null;
  proposedCommand: string | null;
  onAccept: (cmd: string) => void;
  onDecline: () => void;
  onOutput?: (output: string) => void;
  isOpen: boolean;
}

export const TerminalGate: React.FC<TerminalGateProps> = ({ sessionId, proposedCommand, onAccept, onDecline, onOutput, isOpen }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const isExecutingRef = useRef(false);
  const proposedCommandRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => { isExecutingRef.current = isExecuting; }, [isExecuting]);
  useEffect(() => { proposedCommandRef.current = proposedCommand; }, [proposedCommand]);
  useEffect(() => {
    sessionIdRef.current = sessionId || 'default';
    if (xtermRef.current) {
      xtermRef.current.clear();
      (window as any).electron.send('terminal-input', { sessionId: sessionIdRef.current, data: '\r' });
    }
  }, [sessionId]);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#050506',
        foreground: '#e4e4e7',
        cursor: '#6366f1',
        selectionBackground: 'rgba(99, 102, 241, 0.4)',
        black: '#000000', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
        blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#ffffff',
      },
      allowTransparency: true,
      rows: 20,
      cols: 100
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    setTimeout(() => fitAddon.fit(), 100);

    term.onData(data => {
      (window as any).electron.send('terminal-input', { sessionId: sessionIdRef.current || 'default', data });
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    (window as any).electron.send('terminal-input', { sessionId: sessionIdRef.current || 'default', data: '\r' });
  }, []);

  useEffect(() => {
    let chunkBuffer = "";
    const removeListener = (window as any).electron.on('terminal-data', ({ sessionId: sid, data }: { sessionId: string, data: string }) => {
      const targetSid = sessionIdRef.current || 'default';
      const incomingSid = sid || 'default';

      if (incomingSid !== targetSid) return;

      if (xtermRef.current) xtermRef.current.write(data);

      chunkBuffer += data;
      if (chunkBuffer.length > 500) chunkBuffer = chunkBuffer.slice(-500);

      if (isExecutingRef.current) {
        if (chunkBuffer.includes('SUCCESSFUL') || chunkBuffer.includes('NAH')) {
          chunkBuffer = ""; // Reset
          triggerFeedback();
        }
      }
    });

    (window as any).electron.send('terminal-input', { sessionId: sessionIdRef.current || 'default', data: '\r' });

    return () => {
      if (typeof removeListener === 'function') removeListener();
    };
  }, []);

  const triggerFeedback = () => {
    setIsExecuting(false);
    if (onOutput && xtermRef.current) {
      const buffer = xtermRef.current.buffer.active;
      let outputText = '';
      const startLine = Math.max(0, buffer.cursorY - 60);
      for (let i = startLine; i <= buffer.cursorY; i++) {
        const line = buffer.getLine(i);
        if (line) outputText += line.translateToString() + '\n';
      }

      const verificationTag = `\n[SYSTEM_STATUS: EXECUTION_COMPLETE]\n[COMMAND: ${proposedCommandRef.current}]\n`;
      onOutput(verificationTag + outputText);
    }
  };

  useEffect(() => {
    const handleResize = () => fitAddonRef.current?.fit();
    window.addEventListener('resize', handleResize);
    if ((isOpen || proposedCommand) && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 150);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, proposedCommand]);

  const handleRun = async () => {
    if (!proposedCommand) return;
    setIsExecuting(true);
    onAccept(proposedCommand);

    setTimeout(() => {
      if (isExecutingRef.current) triggerFeedback();
    }, 8000);
  };

  const isVisible = isOpen || proposedCommand;

  return (
    <motion.div
      initial={false}
      animate={{
        height: isVisible ? 320 : 0,
        opacity: isVisible ? 1 : 0
      }}
      className="bg-[#050506] border-t border-white/10 flex flex-col relative z-20"
    >
      <AnimatePresence>
        {proposedCommand && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between px-6 py-2 bg-indigo-500/5 border-b border-white/5 shrink-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-[0.2em]">Execute:</span>
              <code className="text-[11px] font-mono text-zinc-300">{proposedCommand}</code>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={onDecline} className="text-[10px] text-zinc-600 hover:text-white transition-colors uppercase tracking-widest font-bold">Cancel</button>
              <button
                onClick={handleRun}
                disabled={isExecuting}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500 text-white text-[10px] font-bold uppercase rounded hover:bg-indigo-400 transition-all disabled:opacity-50"
              >
                {isExecuting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 p-4 overflow-hidden">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </motion.div>
  );
};
