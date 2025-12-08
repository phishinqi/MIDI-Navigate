// frontend/src/components/Visualizer/Visualizer.jsx
import React from 'react';
import useStore from '@/store/useStore';
import EngineP5 from './P5/EngineP5';
import EngineThree from './Three/EngineThree';

const Visualizer = () => {
  const renderEngine = useStore((state) => state.renderEngine);

  return (
    <div className="absolute inset-0 z-0 bg-black overflow-hidden">
      {/* 使用 key 属性强制 React 在切换时完全卸载旧组件并挂载新组件 */}
      {renderEngine === 'three' ? (
        <EngineThree key="engine-three" />
      ) : (
        <EngineP5 key="engine-p5" />
      )}
    </div>
  );
};

export default Visualizer;
