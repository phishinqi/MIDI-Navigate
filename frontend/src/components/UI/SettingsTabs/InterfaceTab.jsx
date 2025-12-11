// frontend/src/components/UI/SettingsTabs/InterfaceTab.jsx
import React from 'react';
import useStore from '@/store/useStore';

// 1. 导入所有子组件，包括我们新创建的按钮
import RenderEngineSelection from './InterfaceTabSections/RenderEngineSelection';
import WsVisualizerButton from './InterfaceTabSections/WsVisualizerButton'; // <--- 导入新组件
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

  return (
    <div className="flex-1 p-6 space-y-8 overflow-y-auto">
      {/* 渲染引擎选择 */}
      <RenderEngineSelection />

      {/* 2. 在这里添加独立的 WS 可视化器启动按钮 */}
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
