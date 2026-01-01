// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/WsVisualizerButton.jsx
import React from 'react';
import { ExternalLink, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WsVisualizerButton = () => {
  const { t } = useTranslation();

  const openWsVisualizer = () => {
    // 定义新窗口的 URL
    const url = '/ws/index.html';

    // 定义窗口的名称和特性
    const windowName = 'midi_ws_visualizer';
    const windowFeatures = 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no,noopener,noreferrer';

    // 使用 window.open 打开一个新窗口
    // 传入窗口名称可以确保每次点击都重用同一个窗口，而不是无限弹出
    window.open(url, windowName, windowFeatures);
  };

  return (
    <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
            {t('ws_visualizer.title', { defaultValue: 'Standalone Visualizer' })}
        </h3>
        <button
            onClick={openWsVisualizer}
            className="w-full py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-white/10 rounded-lg text-sm font-bold flex items-center justify-center gap-3 transition-all group"
        >
            <div className="flex items-center gap-2">
                <Wifi size={16} className="opacity-70 group-hover:opacity-100" />
                <span>{t('ws_visualizer.button', { defaultValue: 'Open WebSocket Visualizer' })}</span>
            </div>
            <ExternalLink size={14} className="opacity-50 group-hover:opacity-90" />
        </button>
        <p className="text-[10px] text-white/40 text-center">
            {t('ws_visualizer.description', { defaultValue: 'Opens a high-performance visualizer in a new window, ideal for direct VST/DAW connection.' })}
        </p>
    </div>
  );
};

export default WsVisualizerButton;
