import React, { useState } from 'react';
import useStore from '@/store/useStore';
import { Settings, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import MixerTab from './SettingsTabs/MixerTab';
import InterfaceTab from './SettingsTabs/InterfaceTab';
import GridTab from './SettingsTabs/GridTab';
import DebugTab from './SettingsTabs/DebugTab';
import HelpTab from './SettingsTabs/HelpTab';

const TrackSettings = ({ onClose, isLight }) => {
  const { t } = useTranslation(); // 初始化 Hook
  const midiData = useStore(state => state.midiData);

  // 如果没有 MIDI 数据，默认显示 'interface' 标签页
  const [activeTab, setActiveTab] = useState(midiData ? 'mixer' : 'interface');

  const modalBg = 'bg-midi-black/95 border-midi-gray text-white backdrop-blur-xl';
  const headerBg = 'bg-white/5 border-white/10';
  const activeTabClass = 'text-white border-midi-accent';
  const inactiveTabClass = 'text-white/30 hover:text-white';

  const renderContent = () => {
    switch (activeTab) {
      case 'mixer':
        // 保护 MixerTab，如果没有 MIDI 数据，显示翻译后的提示信息
        return midiData ? <MixerTab /> : (
            <div className="flex items-center justify-center h-64 text-white/30 italic">
                {t('settings.no_midi_mixer', { defaultValue: 'No MIDI loaded. Mixer controls are disabled.' })}
            </div>
        );
      case 'interface': return <InterfaceTab />;
      case 'grid': return <GridTab />;
      case 'debug': return <DebugTab />;
      case 'help': return <HelpTab />;
      default: return null;
    }
  };

  // 定义标签页列表
  const tabs = ['mixer', 'interface', 'grid', 'debug', 'help'];

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-[600px] border rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden ${modalBg}`}>

        {/* HEADER */}
        <div className={`flex flex-col border-b ${headerBg}`}>
            <div className="flex justify-between items-center p-5 pb-2">
              <div className="flex items-center gap-2 text-midi-accent">
                <Settings size={18} />
                <span className="font-mono font-bold text-lg">
                  {t('settings.title', { defaultValue: 'Control Panel' })}
                </span>
              </div>
              <button onClick={onClose} className="opacity-50 hover:opacity-100"><X size={20} /></button>
            </div>
            <div className="flex px-5 gap-6 mt-2 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 text-sm font-bold tracking-wide border-b-2 transition-all uppercase whitespace-nowrap ${activeTab === tab ? activeTabClass : `border-transparent ${inactiveTabClass}`}`}
                    >
                        {t(`settings.sections.${tab}`, { defaultValue: tab })}
                    </button>
                ))}
            </div>
        </div>
        {renderContent()}

      </div>
    </div>
  );
};

export default TrackSettings;
