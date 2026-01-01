import React from 'react';
import { HelpCircle, User, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const HelpTab = () => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto text-white/90">

      {/* Shortcuts Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-midi-accent">
            <HelpCircle size={20} />
            {t('help.shortcuts_title', { defaultValue: 'Keyboard Shortcuts' })}
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <ShortcutRow label={t('help.shortcuts.play_pause', { defaultValue: 'Play / Pause' })} keys={['Space']} />
          <ShortcutRow label={t('help.shortcuts.open_file', { defaultValue: 'Open File' })} keys={['O']} />
          <ShortcutRow label={t('help.shortcuts.mute', { defaultValue: 'Mute Audio' })} keys={['M']} />
          <ShortcutRow label={t('help.shortcuts.zen_mode', { defaultValue: 'Zen Mode' })} keys={['Z']} />
          <ShortcutRow label={t('help.shortcuts.settings', { defaultValue: 'Settings' })} keys={['S']} />
          <ShortcutRow label={t('help.shortcuts.export', { defaultValue: 'Export' })} keys={['E']} />
        </div>
      </div>

      {/* Author Section */}
      <div className="pt-6 border-t border-white/10 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-midi-accent">
            <User size={20} />
            {t('help.about_title', { defaultValue: 'About' })}
        </h3>

        <div className="bg-white/5 rounded-lg p-5 space-y-3 border border-white/5">
            <div className="flex items-center justify-between">
                <span className="text-sm opacity-60">{t('help.author', { defaultValue: 'Author' })}</span>
                <span className="font-mono font-bold">PurrNeko</span>
            </div>
            <div className="flex items-center justify-between">
                 <span className="text-sm opacity-60 flex items-center gap-2"><Mail size={14}/> {t('help.contact', { defaultValue: 'Contact' })}</span>
                 <span className="font-mono font-bold select-all">2844188892@qq.com</span>
            </div>
            <div className="text-xs text-center pt-2 opacity-30 italic">
                {t('app.title', { defaultValue: 'MIDI-Navigate' })} v2.0.0
            </div>
        </div>
      </div>

    </div>
  );
};

const ShortcutRow = ({ label, keys }) => (
  <div className="p-3 rounded bg-white/5 flex justify-between items-center hover:bg-white/10 transition-colors">
    <span className="opacity-80">{label}</span>
    <div className="flex gap-1">
        {keys.map(k => (
            <kbd key={k} className="px-2 py-1 bg-black/40 border border-white/10 rounded font-mono text-xs font-bold text-midi-accent shadow-sm">{k}</kbd>
        ))}
    </div>
  </div>
);

export default HelpTab;
