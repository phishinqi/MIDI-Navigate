// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/CanvasAppearance.jsx
import React from 'react';
import useStore from '@/store/useStore';
import { Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CanvasAppearance = () => {
    const { t } = useTranslation();
    const backgroundColor = useStore(state => state.backgroundColor);
    const setBackgroundColor = useStore(state => state.setBackgroundColor);
    const colors = ['#040405', '#1a1a1a', '#2d1b2e', '#0f172a', '#f5f5f4', '#e2e8f0', '#E0F2FE', '#FAE8FF', '#FEF9C3', '#DCFCE7'];

    return (
        <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
                {t('canvas_appearance.title', { defaultValue: 'Canvas Appearance' })}
            </h3>

            <div className="flex gap-3 flex-wrap">
                {colors.map(c => (
                    <button
                        key={c}
                        onClick={() => setBackgroundColor(c)}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${backgroundColor === c ? 'border-midi-accent scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        title={c} // 添加 title 方便查看颜色值
                    />
                ))}

                <div className="relative group overflow-hidden w-10 h-10 rounded-full border border-white/20 opacity-50 hover:opacity-100 cursor-pointer flex items-center justify-center transition-all" title={t('canvas_appearance.custom_color', { defaultValue: 'Custom Color' })}>
                    <Palette size={16} />
                    <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
                </div>
            </div>
        </div>
    );
};
export default CanvasAppearance;
