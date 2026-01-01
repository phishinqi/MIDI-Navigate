// frontend\src\components\Visualizer\Visualizer.jsx
import React from 'react';
import useStore from '@/store/useStore';
import EngineP5 from './P5/EngineP5';
import EngineThree from './Three/EngineThree';
import PixiVisualizer from './Pixi/PixiVisualizer';

const Visualizer = () => {
  const renderEngine = useStore((state) => state.renderEngine);

  return (
    <div className="absolute inset-0 z-0 bg-black overflow-hidden">
      {renderEngine === 'three' && <EngineThree key="engine-three" />}
      {renderEngine === 'p5' && <EngineP5 key="engine-p5" />}
      {renderEngine === 'pixi' && <PixiVisualizer key="engine-pixi" />}
    </div>
  );
};

export default Visualizer;
