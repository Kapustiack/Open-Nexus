import React, { useEffect, useRef, useState } from 'react';
import Editor, { DiffEditor, loader } from '@monaco-editor/react';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs' } });

interface CodeEditorProps {
  path: string | null;
  content: string | null;
  onChange?: (content: string) => void;
  onSaveRequest?: (content: string) => void;
  diffMode?: boolean;
  originalContent?: string | null;
  modifiedContent?: string | null;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ path, content, onChange, onSaveRequest, diffMode, originalContent, modifiedContent }) => {
  const editorRef = useRef<any>(null);
  const diffEditorRef = useRef<any>(null);
  const [language, setLanguage] = useState('plaintext');
  const [isMonacoLoaded, setIsMonacoLoaded] = useState(false);

  useEffect(() => {
    if (path) {
      const ext = path.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'ts': case 'tsx': setLanguage('typescript'); break;
        case 'js': case 'jsx': setLanguage('javascript'); break;
        case 'py': setLanguage('python'); break;
        case 'css': setLanguage('css'); break;
        case 'html': setLanguage('html'); break;
        case 'json': setLanguage('json'); break;
        case 'md': setLanguage('markdown'); break;
        default: setLanguage('plaintext');
      }
    }
  }, [path]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    setIsMonacoLoaded(true);
    
    // DEFINE NEXUS DARK THEME
    monaco.editor.defineTheme('nexus-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#050506',
        'editor.lineHighlightBackground': '#ffffff05',
        'editorLineNumber.foreground': '#333333',
        'editor.selectionBackground': '#6366f133',
        'diffEditor.insertedLineBackground': '#14532d55',
        'diffEditor.insertedTextBackground': '#22c55e33',
        'diffEditor.removedLineBackground': '#7f1d1d55',
        'diffEditor.removedTextBackground': '#ef444433',
        'diffEditor.diagonalFill': '#00000000',
      }
    });
    monaco.editor.setTheme('nexus-dark');

    editor.updateOptions({
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollbar: { vertical: 'auto', horizontal: 'auto' },
      renderLineHighlight: 'all',
      automaticLayout: true,
      padding: { top: 20, bottom: 20 }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSaveRequest) {
        onSaveRequest(editor.getValue());
      }
    });
  };

  const handleDiffDidMount = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;
    setIsMonacoLoaded(true);
    monaco.editor.setTheme('nexus-dark');
  };

  if (!path) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050506]">
         <div className="flex flex-col items-center gap-4 opacity-20">
            <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center">
               <div className="w-8 h-8 bg-white/20 rounded-sm rotate-45"></div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white">Open Nexus Idle</span>
         </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#050506] overflow-hidden">
      <div className="h-10 border-b border-white/5 flex items-center px-6 bg-[#080809]/50 shrink-0 justify-between">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500/50"></div>
            <span className="text-[10px] font-mono text-zinc-500 truncate max-w-md">{path}</span>
         </div>
         <div className="flex items-center gap-4">
            <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">{diffMode ? 'DIFF VIEW' : language}</span>
         </div>
      </div>
      
      <div className="flex-1 relative">
        {!isMonacoLoaded && content !== null && (
          <textarea readOnly value={content} className="absolute inset-0 w-full h-full bg-[#050506] text-zinc-400 p-8 font-mono text-xs border-none outline-none resize-none z-10" />
        )}
        
        {diffMode ? (
          <DiffEditor
            height="100%"
            theme="nexus-dark"
            language={language}
            original={originalContent || ''}
            modified={modifiedContent || ''}
            onMount={handleDiffDidMount}
            options={{
              renderSideBySide: true,
              automaticLayout: true,
              originalEditable: false,
              readOnly: true,
              diffWordWrap: 'on',
              renderIndicators: true
            }}
          />
        ) : (
          <Editor
            height="100%"
            theme="nexus-dark"
            language={language}
            value={content || ''}
            onMount={handleEditorDidMount}
            onChange={(val) => onChange && onChange(val || '')}
            options={{
              backgroundColor: '#050506',
              wordWrap: 'on'
            } as any}
            loading={null}
          />
        )}
      </div>
    </div>
  );
};
