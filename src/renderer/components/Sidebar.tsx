import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, FolderTree, Settings as SettingsIcon, FolderOpen, FilePlus, FolderPlus, File, Folder } from 'lucide-react';
import { FileTree, FileNode } from './FileTree';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onOpenSettings: () => void;
  workspace: { path: string, tree: FileNode[] } | null;
  onOpenWorkspace: () => void;
  onFileClick: (path: string) => void;
  onNewItem: (type: 'file' | 'folder' | null) => void;
  newItemType: 'file' | 'folder' | null;
  onCreateItem: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, setIsOpen, onOpenSettings, workspace, onOpenWorkspace, onFileClick, onNewItem, newItemType, onCreateItem
}) => {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute left-4 top-4 z-30 p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-all border border-white/5 shadow-2xl"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <ChevronRight size={16} />
      </button>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCreateItem(inputValue);
      setInputValue('');
    } else if (e.key === 'Escape') {
      onNewItem(null);
      setInputValue('');
    }
  };

  return (
    <motion.div 
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 240, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      className="h-full bg-[#080809] border-r border-white/5 flex flex-col z-20 relative font-sans"
    >
      <div className="p-5 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase">Open Nexus</span>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button onClick={onOpenWorkspace} title="Open Folder" className="text-zinc-600 hover:text-indigo-400 transition-colors">
            <FolderOpen size={14} />
          </button>
          
          <button onClick={() => onNewItem('file')} title="New File" className="text-zinc-600 hover:text-white transition-colors">
            <FilePlus size={14} />
          </button>

          <button onClick={() => onNewItem('folder')} title="New Folder" className="text-zinc-600 hover:text-white transition-colors">
            <FolderPlus size={14} />
          </button>

          <button onClick={() => setIsOpen(false)} className="text-zinc-600 hover:text-white">
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 py-2 overflow-y-auto scrollbar-hide">
         {workspace ? (
           <div className="space-y-1">
             {newItemType && (
               <div className="px-4 py-1 flex items-center gap-2 bg-indigo-500/5 animate-in fade-in slide-in-from-left-1">
                  {newItemType === 'file' ? <File size={12} className="text-indigo-400" /> : <Folder size={12} className="text-indigo-400" />}
                  <input 
                    autoFocus
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => { onNewItem(null); setInputValue(''); }}
                    placeholder={newItemType === 'file' ? "file.txt" : "folder name"}
                    className="bg-transparent border-none text-[11px] text-zinc-300 focus:outline-none w-full placeholder:text-zinc-700"
                  />
               </div>
             )}
             {workspace.tree.map((node, i) => (
               <FileTree key={node.path + i} node={node} onFileClick={onFileClick} />
             ))}
           </div>
         ) : (
           <div className="px-6 py-4 text-[10px] text-zinc-700 italic font-light">
              No workspace active.
           </div>
         )}
      </div>

      <div className="p-4 border-t border-white/5 flex items-center justify-between">
         <button 
          onClick={onOpenSettings}
          className="text-zinc-600 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-md"
          style={{ WebkitAppRegion: 'no-drag' } as any}
         >
           <SettingsIcon size={14} />
         </button>
         <span className="text-[9px] font-mono text-zinc-800 uppercase tracking-tighter">Open Nexus</span>
      </div>
    </motion.div>
  );
};
