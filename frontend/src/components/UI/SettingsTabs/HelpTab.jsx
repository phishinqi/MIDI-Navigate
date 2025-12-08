import React from 'react';
import { HelpCircle } from 'lucide-react';

const HelpTab = () => {
  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2"><HelpCircle /> Keyboard Shortcuts</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded bg-white/5 flex justify-between items-center"><span>Play / Pause</span> <kbd className="px-2 py-1 bg-white/10 rounded font-mono">Space</kbd></div>
          <div className="p-3 rounded bg-white/5 flex justify-between items-center"><span>Open File</span> <kbd className="px-2 py-1 bg-white/10 rounded font-mono">O</kbd></div>
          <div className="p-3 rounded bg-white/5 flex justify-between items-center"><span>Mute Audio</span> <kbd className="px-2 py-1 bg-white/10 rounded font-mono">M</kbd></div>
          <div className="p-3 rounded bg-white/5 flex justify-between items-center"><span>Zen Mode</span> <kbd className="px-2 py-1 bg-white/10 rounded font-mono">Z</kbd></div>
          <div className="p-3 rounded bg-white/5 flex justify-between items-center"><span>Settings</span> <kbd className="px-2 py-1 bg-white/10 rounded font-mono">S</kbd></div>
          <div className="p-3 rounded bg-white/5 flex justify-between items-center"><span>Export</span> <kbd className="px-2 py-1 bg-white/10 rounded font-mono">E</kbd></div>
        </div>
      </div>
    </div>
  );
};

export default HelpTab;
