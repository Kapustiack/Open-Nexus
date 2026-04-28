import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const WindowControls = () => {
  return (
    <div className="absolute top-0 right-0 h-10 flex items-center gap-1 px-4 z-50" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <button 
        onClick={() => window.electron.minimize()}
        className="p-1.5 text-zinc-600 hover:text-white hover:bg-white/5 rounded-md transition-all"
        title="Minimize"
      >
        <Minus size={14} />
      </button>
      <button 
        onClick={() => window.electron.maximize()}
        className="p-1.5 text-zinc-600 hover:text-white hover:bg-white/5 rounded-md transition-all"
        title="Maximize"
      >
        <Square size={12} />
      </button>
      <button 
        onClick={() => window.electron.close()}
        className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
};
