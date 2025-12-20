import React from 'react';
import useStore from '@/store/useStore';
import { useTranslation } from 'react-i18next';
// [FIX] 关键修改：直接从你的配置文件导入初始化好的实例，而不是从库导入
import i18n from '@/i18n';

// 导入所有子组件
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
  // 我们只用 useTranslation 来获取 t 函数以触发重渲染
  const { t } = useTranslation();

  const handleLanguageChange = (lang) => {
    // [FIX] 使用导入的全局实例，并添加安全检查
    if (i18n && typeof i18n.changeLanguage === 'function') {
      i18n.changeLanguage(lang).catch(err => console.error("Language change failed:", err));
    } else {
      console.error("i18n instance is not ready or invalid", i18n);
    }
  };

  // [FIX] 安全获取当前语言，防止 undefined 报错
  const currentLang = i18n?.language || 'en';

  return (
    <div className="flex-1 p-6 space-y-8 overflow-y-auto">

      {/* 语言切换区域 */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5">
        <h3 className="text-sm font-semibold text-white/70">
            {t('settings.language', { defaultValue: 'Language' })}
        </h3>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`px-3 py-1.5 rounded transition-colors ${currentLang.startsWith('en') ? 'bg-midi-accent text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >
            English
          </button>
          <button
            onClick={() => handleLanguageChange('zh')}
            className={`px-3 py-1.5 rounded transition-colors ${currentLang.startsWith('zh') ? 'bg-midi-accent text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
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
