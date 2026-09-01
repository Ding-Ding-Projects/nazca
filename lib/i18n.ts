import type { LanguageMode } from './visitor-state';

export function localize(
  english: string,
  cantonese: string,
  mode: LanguageMode,
) {
  if (mode === 'zh-HK') return cantonese;
  if (mode === 'bilingual') return `${english} · ${cantonese}`;
  return english;
}

export const labels = {
  home: ['Home', '首頁'],
  explore: ['Explore', '探索'],
  stations: ['Stations', '車站'],
  lines: ['Lines', '路線'],
  infrastructure: ['Infrastructure', '基建'],
  places: ['Places', '地點'],
  maps: ['Maps', '地圖'],
  timeline: ['Timeline', '時間線'],
  streetcars: ['Streetcars', '電車'],
  media: ['Media', '媒體'],
  history: ['History', '歷史'],
  changelog: ['Changelog', '更新記錄'],
  status: ['Status', '狀態'],
  tools: ['Tools', '工具'],
  settings: ['Settings', '設定'],
  help: ['Help', '說明'],
  about: ['About', '關於'],
} as const;
