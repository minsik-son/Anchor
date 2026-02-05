/**
 * i18n Configuration
 * Multi-language support with expo-localization
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

const resources = {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
};

// Get device locale
const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'ko';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: deviceLocale, // Use device locale
        fallbackLng: 'ko', // Fallback to Korean
        compatibilityJSON: 'v4',
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
