import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from 'lucide-react';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface FileTreeProps {
  node: FileNode;
  onFileClick: (path: string) => void;
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ node, onFileClick, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    if (node.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(node.path);
    }
  };

  return (
    <div className="select-none">
      <div 
        onClick={handleToggle}
        className="flex items-center gap-2 py-1 px-2 hover:bg-white/[0.03] rounded-md cursor-pointer transition-colors group"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
          {node.isDirectory ? (
            isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <div className="w-3" />
          )}
        </span>
        
        <span className="text-indigo-400/70 group-hover:text-indigo-400 transition-colors">
          {node.isDirectory ? (
            isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />
          ) : (
            <FileCode size={14} />
          )}
        </span>

        <span className={`text-[11px] truncate ${node.isDirectory ? 'text-zinc-400 font-medium' : 'text-zinc-500'}`}>
          {node.name}
        </span>
      </div>

      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileTree 
              key={child.path + i} 
              node={child} 
              onFileClick={onFileClick} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};
