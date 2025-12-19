import i18next from 'i18next';

// Import translations directly
import en from './locales/en/translation.json';
import de from './locales/de/translation.json';

// Get saved language from localStorage or default to German
const savedLanguage = localStorage.getItem('language') || 'de';

i18next.init({
  lng: savedLanguage,
  fallbackLng: 'de',
  debug: false,
  resources: {
    en: { translation: en },
    de: { translation: de }
  },
  interpolation: {
    escapeValue: false
  }
});

export default i18next;

// Helper function to change language
export function changeLanguage(lang: string): void {
  i18next.changeLanguage(lang);
  localStorage.setItem('language', lang);
  // Trigger UI update event
  window.dispatchEvent(new CustomEvent('language-changed'));
}

// Helper function to translate
export function t(key: string, options?: object): string {
  return i18next.t(key, options);
}

// Get current language
export function getCurrentLanguage(): string {
  return i18next.language;
}
