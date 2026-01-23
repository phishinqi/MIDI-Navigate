// ws/i18n.ts
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import zhTranslation from './locales/zh/translation.json';

i18n
    .use(LanguageDetector)
    .init({
        resources: {
            en: { translation: enTranslation },
            zh: { translation: zhTranslation }
        },
        fallbackLng: 'en',
        debug: false,
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;

// 辅助函数用于vanilla JS中使用翻译
export function t(key: string): string {
    return i18n.t(key);
}

// 监听语言变化
export function onLanguageChanged(callback: (lng: string) => void): void {
    i18n.on('languageChanged', callback);
}

// 获取当前语言
export function getCurrentLanguage(): string {
    return i18n.language;
}
