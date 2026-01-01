// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/RenderEngineSelection.jsx
import React from 'react';
import useStore from '@/store/useStore';
import { Box, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const RenderEngineSelection = () => {
    const { t } = useTranslation();
    const renderEngine = useStore(state => state.renderEngine);
    const setRenderEngine = useStore(state => state.setRenderEngine);

    return (
        <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
                {t('render_engine.title', { defaultValue: 'Render Engine' })}
            </h3>
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/20 rounded-lg">
                <button
                    onClick={() => setRenderEngine('three')}
                    className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${renderEngine === 'three' ? 'bg-midi-accent text-black shadow' : 'text-white/50 hover:text-white'}`}
                >
                    <Box size={14} /> Three.js
                </button>
                <button
                    onClick={() => setRenderEngine('p5')}
                    className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${renderEngine === 'p5' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'}`}
                >
                    <Monitor size={14} /> p5.js
                </button>
            </div>
        </div>
    );
};

export default RenderEngineSelection;
