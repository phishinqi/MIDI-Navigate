import React from 'react';
import useStore from '@/store/useStore';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

import RenderEngineSelection from './InterfaceTabSections/RenderEngineSelection';
import WsVisualizerButton from './InterfaceTabSections/WsVisualizerButton';
import ThreeJsSettings from './InterfaceTabSections/ThreeJsSettings';
import P5JsSettings from './InterfaceTabSections/P5JsSettings';
import CanvasAppearance from './InterfaceTabSections/CanvasAppearance';
import AudioIOSettings from './InterfaceTabSections/AudioIOSettings';
import AnalysisSettings from './InterfaceTabSections/AnalysisSettings';
import VisualsSettings from './InterfaceTabSections/VisualsSettings';
import WidgetSettings from './InterfaceTabSections/WidgetSettings';
import SystemConfig from './InterfaceTabSections/SystemConfig';

const InterfaceTab = () => {
  const renderEngine = useStore(state => state.renderEngine);
  const { t } = useTranslation();

  const handleLanguageChange = (lang) => {
    if (i18n && typeof i18n.changeLanguage === 'function') {
      i18n.changeLanguage(lang).catch(err => console.error("Language change failed:", err));
    } else {
      console.error("i18n instance is not ready or invalid", i18n);
    }
  };

  const currentLang = i18n?.language || 'en';

  return (
    <div className="flex-1 p-6 space-y-8 overflow-y-auto">

      {/* 语言切换区域 */}
      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
          {t('settings.language', { defaultValue: 'Language' })}
        </h3>
        <div className="flex gap-1 p-1 bg-black/20 rounded-lg">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${currentLang.startsWith('en') ? 'bg-midi-accent text-black shadow' : 'text-white/40 hover:text-white'}`}
          >
            English
          </button>
          <button
            onClick={() => handleLanguageChange('zh')}
            className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${currentLang.startsWith('zh') ? 'bg-midi-accent text-black shadow' : 'text-white/40 hover:text-white'}`}
          >
            中文
          </button>
        </div>
      </div>

      {/* 渲染引擎选择 */}
      <RenderEngineSelection />

      {/* 独立的 WS 可视化器启动按钮 */}
      <WsVisualizerButton />

      {/* 条件渲染的引擎专属设置 */}
      {renderEngine === 'three' && <ThreeJsSettings />}
      {renderEngine === 'p5' && <P5JsSettings />}

      {/* 其他常驻设置 */}
      <CanvasAppearance />
      <AudioIOSettings />
      <AnalysisSettings />
      <VisualsSettings />
      <WidgetSettings />
      <SystemConfig />
    </div>
  );
};

export default InterfaceTab;
