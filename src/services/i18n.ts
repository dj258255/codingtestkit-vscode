import * as vscode from 'vscode';

export type Lang = 'KO' | 'EN';

let currentLang: Lang = 'KO';

export function initI18n(): void {
  const config = vscode.workspace.getConfiguration('codingtestkit');
  currentLang = (config.get<string>('language') as Lang) || 'KO';
}

export function setLanguage(lang: Lang): void {
  currentLang = lang;
  vscode.workspace.getConfiguration('codingtestkit').update('language', lang, vscode.ConfigurationTarget.Global);
}

export function getLang(): Lang {
  return currentLang;
}

/** Returns Korean or English string based on current language */
export function t(ko: string, en: string): string {
  return currentLang === 'KO' ? ko : en;
}
