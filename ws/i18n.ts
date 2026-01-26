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

export function t(key: string): string {
    return i18n.t(key);
}

export function onLanguageChanged(callback: (lng: string) => void): void {
    i18n.on('languageChanged', callback);
}

export function getCurrentLanguage(): string {
    return i18n.language;
}
