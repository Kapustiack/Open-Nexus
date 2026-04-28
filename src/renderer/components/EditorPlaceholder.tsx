import React from 'react';

interface EditorPlaceholderProps {
  isSidebarOpen: boolean;
}

export const EditorPlaceholder: React.FC<EditorPlaceholderProps> = ({ isSidebarOpen }) => {
  return (
    <div className="flex-1 flex items-center justify-center relative">
        <div className="text-center space-y-4 max-w-xs animate-in fade-in duration-1000">
          <p className="text-zinc-700 font-light tracking-widest text-[10px] uppercase">Open Nexus Initialized</p>
          <div className="h-[1px] w-8 bg-zinc-900 mx-auto opacity-50"></div>
        </div>
    </div>
  );
};
