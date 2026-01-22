// frontend/src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import zhTranslation from './locales/zh/translation.json';

// 必须先初始化
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      zh: { translation: zhTranslation }
    },
    fallbackLng: 'en',
    debug: true, // 开发时保持 true，观察控制台是否有资源加载错误
    interpolation: {
      escapeValue: false
    }
  });

export default i18n; // 必须导出这个实例
