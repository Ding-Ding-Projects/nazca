'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import { useVisitorState } from '@/components/visitor-state-provider';
import { localize } from '@/lib/i18n';
import {
  hasSchoolCredential,
  parseVocabularyFile,
  saveVocabulary,
  setSchoolCredential,
  verifySchoolCredential,
  type LanguageMode,
  type ScheduleRule,
  type VisitorSettings,
} from '@/lib/visitor-state';

type SettingsTab =
  | 'general'
  | 'language'
  | 'appearance'
  | 'school'
  | 'narrator'
  | 'schedules'
  | 'attention'
  | 'privacy';

const tabs: Array<{ id: SettingsTab; en: string; zh: string }> = [
  { id: 'general', en: 'General', zh: '一般' },
  { id: 'language', en: 'Language and wording', zh: '語言同文字' },
  { id: 'appearance', en: 'Appearance', zh: '外觀' },
  { id: 'school', en: 'School mode', zh: '學校模式' },
  { id: 'narrator', en: 'Narrator', zh: '旁白' },
  { id: 'schedules', en: 'Scheduled settings', zh: '排程設定' },
  { id: 'attention', en: 'Attention modes', zh: '專注模式' },
  { id: 'privacy', en: 'Data and privacy', zh: '資料同私隱' },
];

const controlsByTab: Record<
  SettingsTab,
  Array<{ id: string; en: string; zh: string; description: string }>
> = {
  general: [
    {
      id: 'setting-display-name',
      en: 'Display name',
      zh: '顯示名稱',
      description: 'Rename the interface without changing its stable identity.',
    },
    {
      id: 'setting-dialog-emojis',
      en: 'Dialog emojis',
      zh: '對話框表情符號',
      description: 'Show optional decorative emoji in dialogs.',
    },
  ],
  language: [
    {
      id: 'setting-language',
      en: 'Language mode',
      zh: '語言模式',
      description: 'Choose English, Cantonese, or both.',
    },
    {
      id: 'setting-funny-en',
      en: 'English funny level',
      zh: '英文幽默程度',
      description: 'Adjust English wording from serious to playful.',
    },
    {
      id: 'setting-funny-zh',
      en: 'Cantonese funny level',
      zh: '廣東話幽默程度',
      description: 'Adjust Cantonese wording independently.',
    },
    {
      id: 'setting-vocabulary',
      en: 'Personal vocabulary',
      zh: '個人詞彙',
      description: 'Load a bounded local JSON file without network access.',
    },
  ],
  appearance: [
    {
      id: 'setting-theme',
      en: 'Theme',
      zh: '主題',
      description: 'Choose system, light, or dark presentation.',
    },
    {
      id: 'setting-density',
      en: 'Density',
      zh: '密度',
      description: 'Choose comfortable or compact spacing.',
    },
    {
      id: 'setting-seed-color',
      en: 'Seed color',
      zh: '主色',
      description: 'Set the live primary color.',
    },
  ],
  school: [
    {
      id: 'setting-school-name',
      en: 'Mode name',
      zh: '模式名稱',
      description: 'Rename the shared mode.',
    },
    {
      id: 'setting-school-toggle',
      en: 'Mode state',
      zh: '模式狀態',
      description: 'Enable or unlock the mode locally.',
    },
  ],
  narrator: [
    {
      id: 'setting-narrator-enabled',
      en: 'Narrator',
      zh: '旁白',
      description: 'Enable spoken interface events.',
    },
    {
      id: 'setting-narrator-voices',
      en: 'Voices',
      zh: '聲音',
      description: 'Choose independent English and Cantonese voices.',
    },
    {
      id: 'setting-narrator-rate',
      en: 'Rate and pitch',
      zh: '速度同音調',
      description: 'Adjust delivery within browser ranges.',
    },
  ],
  schedules: [
    {
      id: 'setting-schedule-create',
      en: 'Create schedule',
      zh: '新增排程',
      description: 'Apply language or theme during a local time window.',
    },
    {
      id: 'setting-schedule-list',
      en: 'Schedule list',
      zh: '排程清單',
      description: 'Review and remove local schedule rules.',
    },
  ],
  attention: [
    {
      id: 'setting-attention-focus',
      en: 'Focus',
      zh: '聚焦',
      description: 'Bring the active section forward without hiding content.',
    },
    {
      id: 'setting-attention-low',
      en: 'Low stimulation',
      zh: '低刺激',
      description: 'Reduce non-essential motion and color.',
    },
    {
      id: 'setting-attention-time',
      en: 'Time awareness',
      zh: '時間提示',
      description: 'Show elapsed time where work happens.',
    },
    {
      id: 'setting-attention-one',
      en: 'One thing at a time',
      zh: '一次一件事',
      description: 'Keep one user-selected next action visible.',
    },
    {
      id: 'setting-attention-momentum',
      en: 'Momentum',
      zh: '動力提示',
      description: 'Show a respectful, snoozable inactivity prompt.',
    },
  ],
  privacy: [
    {
      id: 'setting-storage-status',
      en: 'Storage status',
      zh: '儲存狀態',
      description: 'Review the local browser boundary and recovery path.',
    },
    {
      id: 'setting-reset-note',
      en: 'Reset and exports',
      zh: '重設同匯出',
      description:
        'Private vocabulary and credential records are omitted from ordinary exports.',
    },
  ],
};

export function SettingsWorkspace() {
  const {
    state,
    ready,
    storageError,
    vocabulary,
    updateSettings,
    setVocabulary,
    clearVocabularyState,
    text,
  } = useVisitorState();
  const { settings } = state;
  const effectiveLanguage: LanguageMode = settings.schoolMode.enabled
    ? 'en'
    : settings.languageMode;
  const L = (en: string, zh: string) =>
    text(localize(en, zh, effectiveLanguage));
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [credential, setCredential] = useState('');
  const [credentialStatus, setCredentialStatus] = useState('');
  const [vocabularyStatus, setVocabularyStatus] = useState(
    'No personal vocabulary file loaded.',
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [scheduleLabel, setScheduleLabel] = useState('Evening reading');
  const [scheduleStart, setScheduleStart] = useState('18:00');
  const [scheduleEnd, setScheduleEnd] = useState('23:00');

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, []);

  useEffect(() => {
    if (
      settings.schoolMode.enabled &&
      ['language', 'narrator'].includes(activeTab)
    )
      setActiveTab('school');
  }, [activeTab, settings.schoolMode.enabled]);

  const visibleTabs = tabs.filter(
    (tab) =>
      !settings.schoolMode.enabled ||
      !['language', 'narrator'].includes(tab.id),
  );
  const searchRecords = useMemo<SearchRecord[]>(
    () =>
      controlsByTab[activeTab].map((control) => ({
        id: control.id,
        title: L(control.en, control.zh),
        subtitle: control.description,
        text: `${control.en} ${control.zh} ${control.description}`,
      })),
    [activeTab, effectiveLanguage, vocabulary],
  );

  const updateNarrator = (patch: Partial<typeof settings.narrator>) =>
    updateSettings({ narrator: { ...settings.narrator, ...patch } });
  const updateAttention = (patch: Partial<typeof settings.attention>) =>
    updateSettings({ attention: { ...settings.attention, ...patch } });

  const loadVocabularyFile = async (file: File | undefined) => {
    if (!file) return;
    setVocabularyStatus('Reading and validating locally…');
    try {
      const entries = await parseVocabularyFile(file);
      await saveVocabulary(entries);
      setVocabulary(entries);
      setVocabularyStatus(
        `${entries.length} entries loaded locally. No network request was made.`,
      );
    } catch (error) {
      setVocabularyStatus(
        error instanceof Error ? error.message : 'The file is invalid.',
      );
    }
  };

  const toggleSchoolMode = async () => {
    try {
      if (!settings.schoolMode.enabled) {
        if (!(await hasSchoolCredential())) {
          await setSchoolCredential(credential);
        } else if (!(await verifySchoolCredential(credential))) {
          setCredentialStatus('The value did not match the local credential.');
          return;
        }
        updateSettings({
          schoolMode: { ...settings.schoolMode, enabled: true },
        });
        setActiveTab('school');
        setCredentialStatus(
          `${settings.schoolMode.displayName} is enabled. English presentation is forced.`,
        );
      } else {
        if (!(await verifySchoolCredential(credential))) {
          setCredentialStatus(
            'The value did not match. Clear this origin’s browser storage to recover.',
          );
          return;
        }
        updateSettings({
          schoolMode: { ...settings.schoolMode, enabled: false },
        });
        setCredentialStatus(
          `${settings.schoolMode.displayName} is disabled. Stored choices are restored.`,
        );
      }
      setCredential('');
    } catch (error) {
      setCredentialStatus(
        error instanceof Error
          ? error.message
          : 'The local credential operation failed.',
      );
    }
  };

  const previewNarrator = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      settings.narrator.language === 'zh-HK'
        ? '旁白測試。'
        : 'Narrator preview.',
    );
    const selected = voices.find((voice) =>
      [
        settings.narrator.englishVoiceId,
        settings.narrator.cantoneseVoiceId,
      ].includes(voice.voiceURI),
    );
    if (selected) utterance.voice = selected;
    utterance.rate = settings.narrator.rate;
    utterance.pitch = settings.narrator.pitch;
    window.speechSynthesis.speak(utterance);
  };

  const addSchedule = () => {
    const rule: ScheduleRule = {
      id: crypto.randomUUID(),
      label: scheduleLabel.trim() || 'Local schedule',
      enabled: true,
      startTime: scheduleStart,
      endTime: scheduleEnd,
      days: [0, 1, 2, 3, 4, 5, 6],
      theme: 'dark',
    };
    updateSettings({ schedules: [...settings.schedules, rule] });
  };

  return (
    <section className="settings-workspace" aria-labelledby="settings-heading">
      <p className="eyebrow">{L('Visitor settings', '訪客設定')}</p>
      <h1 id="settings-heading" className="workspace-title">
        {L('Settings that explain themselves.', '每個設定都講清楚自己做乜。')}
      </h1>
      <p className="lede">
        {L(
          'Settings stay in this browser. Sensitive local records are separated from ordinary state and omitted from normal exports.',
          '設定只留喺呢個瀏覽器。敏感本機記錄會同一般狀態分開，普通匯出亦唔會帶走。',
        )}
      </p>

      <div className="settings-layout">
        <nav
          className="settings-tabs"
          aria-label={L('Settings tabs', '設定分頁')}
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.id === 'school'
                ? settings.schoolMode.displayName
                : L(tab.en, tab.zh)}
            </button>
          ))}
        </nav>
        <div className="settings-panel">
          <SearchWorkbench
            surfaceId={`settings-${activeTab}-search`}
            label={L(`Search ${activeTab} settings`, `搜尋${activeTab}設定`)}
            placeholder={L('Find a setting', '搵設定')}
            records={searchRecords}
            onActivate={(record) => document.getElementById(record.id)?.focus()}
          />

          {activeTab === 'general' ? (
            <div className="settings-list">
              <label className="setting-row" htmlFor="setting-display-name">
                <span>
                  <strong>{L('Display name', '顯示名稱')}</strong>
                  <small>
                    {L(
                      'Changes visible branding only. Stable storage and deployment identity do not move.',
                      '只改畫面名稱，儲存同部署身份唔會搬屋。',
                    )}
                  </small>
                </span>
                <input
                  id="setting-display-name"
                  value={settings.displayName ?? ''}
                  placeholder="Nazca Railway"
                  maxLength={80}
                  onChange={(event) =>
                    updateSettings({ displayName: event.target.value || null })
                  }
                />
              </label>
              <label className="setting-row" htmlFor="setting-dialog-emojis">
                <span>
                  <strong>
                    {L(
                      'Show emojis in dialogs and message boxes',
                      '對話框同訊息盒顯示表情符號',
                    )}
                  </strong>
                  <small>
                    {L(
                      'Decoration only. Buttons and accessible names stay factual.',
                      '只係裝飾，按鈕同無障礙名稱照樣講事實。',
                    )}
                  </small>
                </span>
                <input
                  id="setting-dialog-emojis"
                  type="checkbox"
                  checked={settings.showDialogEmojis}
                  onChange={(event) =>
                    updateSettings({ showDialogEmojis: event.target.checked })
                  }
                />
              </label>
              <p className="settings-status" role="status">
                {ready
                  ? L('Visitor state is ready.', '訪客狀態已準備好。')
                  : L('Loading local visitor state…', '載入本機訪客狀態…')}{' '}
                {storageError}
              </p>
            </div>
          ) : null}

          {activeTab === 'language' && !settings.schoolMode.enabled ? (
            <div className="settings-list">
              <label className="setting-row" htmlFor="setting-language">
                <span>
                  <strong>{L('Language mode', '語言模式')}</strong>
                  <small>
                    {L(
                      'Article bodies remain faithful English until reviewed translations exist.',
                      '文章正文會保持英文，等審核過嘅翻譯先加入。',
                    )}
                  </small>
                </span>
                <select
                  id="setting-language"
                  value={settings.languageMode}
                  onChange={(event) =>
                    updateSettings({
                      languageMode: event.target.value as LanguageMode,
                    })
                  }
                >
                  <option value="en">English</option>
                  <option value="zh-HK">廣東話</option>
                  <option value="bilingual">English + 廣東話</option>
                </select>
              </label>
              <label className="setting-row" htmlFor="setting-funny-en">
                <span>
                  <strong>{L('English funny level', '英文幽默程度')}</strong>
                  <small>1 = serious, 5 = maximum playfulness</small>
                </span>
                <input
                  id="setting-funny-en"
                  type="range"
                  min="1"
                  max="5"
                  value={settings.funnyLevelEnglish}
                  onChange={(event) =>
                    updateSettings({
                      funnyLevelEnglish: Number(event.target.value),
                    })
                  }
                />
                <output>{settings.funnyLevelEnglish}</output>
              </label>
              <label className="setting-row" htmlFor="setting-funny-zh">
                <span>
                  <strong>
                    {L('Cantonese funny level', '廣東話幽默程度')}
                  </strong>
                  <small>1 = 正經，5 = 最玩得</small>
                </span>
                <input
                  id="setting-funny-zh"
                  type="range"
                  min="1"
                  max="5"
                  value={settings.funnyLevelCantonese}
                  onChange={(event) =>
                    updateSettings({
                      funnyLevelCantonese: Number(event.target.value),
                    })
                  }
                />
                <output>{settings.funnyLevelCantonese}</output>
              </label>
              <div
                className="setting-row"
                id="setting-vocabulary"
                tabIndex={-1}
              >
                <span>
                  <strong>
                    {L('Personal vocabulary JSON', '個人詞彙 JSON')}
                  </strong>
                  <small>
                    {L(
                      'Validated locally, stored locally, never sent or included in ordinary exports.',
                      '本機驗證、本機儲存，唔會傳走或放入普通匯出。',
                    )}
                  </small>
                </span>
                <div className="setting-actions">
                  <input
                    type="file"
                    accept="application/json,.json"
                    aria-label={L(
                      'Choose personal vocabulary JSON',
                      '選擇個人詞彙 JSON',
                    )}
                    onChange={(event) =>
                      loadVocabularyFile(event.target.files?.[0])
                    }
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await clearVocabularyState();
                      setVocabularyStatus(
                        'Personal vocabulary cleared. Original wording restored.',
                      );
                    }}
                  >
                    {L('Clear', '清除')}
                  </button>
                </div>
                <p role="status">
                  {vocabulary.length
                    ? `${vocabulary.length} entries active. `
                    : ''}
                  {vocabularyStatus}
                </p>
              </div>
            </div>
          ) : null}

          {activeTab === 'appearance' ? (
            <div className="settings-list">
              <label className="setting-row" htmlFor="setting-theme">
                <span>
                  <strong>{L('Theme', '主題')}</strong>
                  <small>
                    {L(
                      'Applies live and follows the system when selected.',
                      '即時套用，揀系統就跟裝置。',
                    )}
                  </small>
                </span>
                <select
                  id="setting-theme"
                  value={settings.theme}
                  onChange={(event) =>
                    updateSettings({
                      theme: event.target.value as VisitorSettings['theme'],
                    })
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="setting-row" htmlFor="setting-density">
                <span>
                  <strong>{L('Density', '密度')}</strong>
                  <small>
                    {L(
                      'Compact reduces spacing without reducing touch targets.',
                      '緊密模式縮間距，唔縮細觸控範圍。',
                    )}
                  </small>
                </span>
                <select
                  id="setting-density"
                  value={settings.density}
                  onChange={(event) =>
                    updateSettings({
                      density: event.target.value as VisitorSettings['density'],
                    })
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <label className="setting-row" htmlFor="setting-seed-color">
                <span>
                  <strong>{L('Seed color', '主色')}</strong>
                  <small>
                    {L(
                      'Current value came from local visitor settings.',
                      '目前數值來自本機訪客設定。',
                    )}
                  </small>
                </span>
                <input
                  id="setting-seed-color"
                  type="color"
                  value={settings.seedColor}
                  onChange={(event) =>
                    updateSettings({ seedColor: event.target.value })
                  }
                />
              </label>
            </div>
          ) : null}

          {activeTab === 'school' ? (
            <div className="settings-list">
              <label className="setting-row" htmlFor="setting-school-name">
                <span>
                  <strong>{settings.schoolMode.displayName}</strong>
                  <small>
                    Rename this mode. Once renamed, the chosen name is used on
                    active surfaces.
                  </small>
                </span>
                <input
                  id="setting-school-name"
                  value={settings.schoolMode.displayName}
                  maxLength={80}
                  onChange={(event) =>
                    updateSettings({
                      schoolMode: {
                        ...settings.schoolMode,
                        displayName:
                          event.target.value || settings.schoolMode.displayName,
                      },
                    })
                  }
                />
              </label>
              <div
                className="setting-row"
                id="setting-school-toggle"
                tabIndex={-1}
              >
                <span>
                  <strong>
                    {settings.schoolMode.enabled
                      ? `Unlock ${settings.schoolMode.displayName}`
                      : `Enable ${settings.schoolMode.displayName}`}
                  </strong>
                  <small>
                    This is a local experience lock, not a security boundary.
                    Clearing this origin’s browser storage is the recovery path.
                  </small>
                </span>
                <div className="setting-actions">
                  <input
                    type="password"
                    value={credential}
                    minLength={4}
                    maxLength={128}
                    aria-label="Local mode credential"
                    onChange={(event) => setCredential(event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={credential.length < 4}
                    onClick={toggleSchoolMode}
                  >
                    {settings.schoolMode.enabled ? 'Unlock' : 'Enable'}
                  </button>
                </div>
                <p role="status">{credentialStatus}</p>
              </div>
            </div>
          ) : null}

          {activeTab === 'narrator' && !settings.schoolMode.enabled ? (
            <div className="settings-list">
              <label className="setting-row" htmlFor="setting-narrator-enabled">
                <span>
                  <strong>{L('Narrator', '旁白')}</strong>
                  <small>
                    {L(
                      'Off by default. Speech stays serialized and local to browser voices.',
                      '預設關閉，語音會逐句播放，只用瀏覽器聲音。',
                    )}
                  </small>
                </span>
                <input
                  id="setting-narrator-enabled"
                  type="checkbox"
                  checked={settings.narrator.enabled}
                  onChange={(event) =>
                    updateNarrator({ enabled: event.target.checked })
                  }
                />
              </label>
              <label
                className="setting-row"
                htmlFor="setting-narrator-language"
              >
                <span>
                  <strong>{L('Narrated language', '旁白語言')}</strong>
                  <small>
                    {L(
                      'Both speaks English, then Cantonese.',
                      '雙語會先英文，後廣東話。',
                    )}
                  </small>
                </span>
                <select
                  id="setting-narrator-language"
                  value={settings.narrator.language}
                  onChange={(event) =>
                    updateNarrator({
                      language: event.target
                        .value as VisitorSettings['narrator']['language'],
                    })
                  }
                >
                  <option value="en">English</option>
                  <option value="zh-HK">廣東話</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label
                className="setting-row"
                htmlFor="setting-narrator-en-voice"
              >
                <span>
                  <strong>English voice</strong>
                  <small>
                    {voices.length
                      ? 'Voices were enumerated from this browser.'
                      : 'Voice list is waiting for the browser.'}
                  </small>
                </span>
                <select
                  id="setting-narrator-en-voice"
                  value={settings.narrator.englishVoiceId}
                  onChange={(event) =>
                    updateNarrator({ englishVoiceId: event.target.value })
                  }
                >
                  <option value="auto">Choose automatically</option>
                  {voices
                    .filter((voice) =>
                      voice.lang.toLocaleLowerCase().startsWith('en'),
                    )
                    .map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} · {voice.lang}
                      </option>
                    ))}
                </select>
              </label>
              <label
                className="setting-row"
                htmlFor="setting-narrator-zh-voice"
              >
                <span>
                  <strong>廣東話聲音</strong>
                  <small>列出瀏覽器現有嘅粵語聲音。</small>
                </span>
                <select
                  id="setting-narrator-zh-voice"
                  value={settings.narrator.cantoneseVoiceId}
                  onChange={(event) =>
                    updateNarrator({ cantoneseVoiceId: event.target.value })
                  }
                >
                  <option value="auto">自動選擇</option>
                  {voices
                    .filter((voice) => /zh-(hk|hant)|yue/i.test(voice.lang))
                    .map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} · {voice.lang}
                      </option>
                    ))}
                </select>
              </label>
              <label className="setting-row" htmlFor="setting-narrator-rate">
                <span>
                  <strong>{L('Rate', '速度')}</strong>
                  <small>{settings.narrator.rate.toFixed(1)}</small>
                </span>
                <input
                  id="setting-narrator-rate"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.narrator.rate}
                  onChange={(event) =>
                    updateNarrator({ rate: Number(event.target.value) })
                  }
                />
              </label>
              <label className="setting-row" htmlFor="setting-narrator-pitch">
                <span>
                  <strong>{L('Pitch', '音調')}</strong>
                  <small>{settings.narrator.pitch.toFixed(1)}</small>
                </span>
                <input
                  id="setting-narrator-pitch"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.narrator.pitch}
                  onChange={(event) =>
                    updateNarrator({ pitch: Number(event.target.value) })
                  }
                />
              </label>
              <button
                type="button"
                className="primary-action"
                onClick={previewNarrator}
              >
                {L('Preview narrator', '試聽旁白')}
              </button>
            </div>
          ) : null}

          {activeTab === 'schedules' ? (
            <div className="settings-list">
              <div
                className="setting-row"
                id="setting-schedule-create"
                tabIndex={-1}
              >
                <span>
                  <strong>
                    {L('Create a local schedule', '新增本機排程')}
                  </strong>
                  <small>
                    {L(
                      'Every day uses one rule. Equal start and end means the full day.',
                      '每日只用一條規則；開始同結束一樣代表全日。',
                    )}
                  </small>
                </span>
                <div className="schedule-editor">
                  <input
                    value={scheduleLabel}
                    aria-label="Schedule label"
                    onChange={(event) => setScheduleLabel(event.target.value)}
                  />
                  <input
                    type="time"
                    value={scheduleStart}
                    aria-label="Start time"
                    onChange={(event) => setScheduleStart(event.target.value)}
                  />
                  <input
                    type="time"
                    value={scheduleEnd}
                    aria-label="End time"
                    onChange={(event) => setScheduleEnd(event.target.value)}
                  />
                  <button type="button" onClick={addSchedule}>
                    {L('Add', '新增')}
                  </button>
                </div>
              </div>
              <div
                className="setting-row"
                id="setting-schedule-list"
                tabIndex={-1}
              >
                <span>
                  <strong>{L('Schedule list', '排程清單')}</strong>
                  <small>
                    {Intl.DateTimeFormat().resolvedOptions().timeZone} · local
                    daylight-saving rules apply.
                  </small>
                </span>
                <ul className="schedule-list">
                  {settings.schedules.length ? (
                    settings.schedules.map((rule) => (
                      <li key={rule.id}>
                        <span>
                          {rule.label} · {rule.startTime}–{rule.endTime}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({
                              schedules: settings.schedules.filter(
                                (candidate) => candidate.id !== rule.id,
                              ),
                            })
                          }
                        >
                          {L('Remove', '移除')}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li>{L('No schedule rules.', '未有排程。')}</li>
                  )}
                </ul>
              </div>
            </div>
          ) : null}

          {activeTab === 'attention' ? (
            <div className="settings-list">
              {(
                [
                  ['focus', 'Focus', '聚焦'],
                  ['lowStimulation', 'Low stimulation', '低刺激'],
                  ['timeAwareness', 'Time awareness', '時間提示'],
                  ['oneThingAtATime', 'One thing at a time', '一次一件事'],
                  ['momentum', 'Momentum', '動力提示'],
                ] as const
              ).map(([key, en, zh]) => {
                const controlIds = {
                  focus: 'setting-attention-focus',
                  lowStimulation: 'setting-attention-low',
                  timeAwareness: 'setting-attention-time',
                  oneThingAtATime: 'setting-attention-one',
                  momentum: 'setting-attention-momentum',
                } as const;
                return (
                  <label
                    className="setting-row"
                    htmlFor={controlIds[key]}
                    key={key}
                  >
                    <span>
                      <strong>{L(en, zh)}</strong>
                      <small>
                        {L(
                          'Off by default and independently controlled.',
                          '預設關閉，可以獨立控制。',
                        )}
                      </small>
                    </span>
                    <input
                      id={controlIds[key]}
                      type="checkbox"
                      checked={settings.attention[key]}
                      onChange={(event) =>
                        updateAttention({ [key]: event.target.checked })
                      }
                    />
                  </label>
                );
              })}
              <label className="setting-row" htmlFor="setting-next-action">
                <span>
                  <strong>{L('Current next action', '目前下一步')}</strong>
                  <small>
                    {L(
                      'Chosen by you and kept across context switches.',
                      '由你揀，轉完畫面都會保留。',
                    )}
                  </small>
                </span>
                <input
                  id="setting-next-action"
                  value={settings.attention.nextAction ?? ''}
                  maxLength={240}
                  onChange={(event) =>
                    updateAttention({ nextAction: event.target.value || null })
                  }
                />
              </label>
            </div>
          ) : null}

          {activeTab === 'privacy' ? (
            <div className="settings-list">
              <div
                className="setting-row"
                id="setting-storage-status"
                tabIndex={-1}
              >
                <span>
                  <strong>
                    {L('Browser-local storage', '瀏覽器本機儲存')}
                  </strong>
                  <small>
                    {L(
                      'Settings use IndexedDB. Boot theme alone uses localStorage. No analytics or synchronization is configured.',
                      '設定用 IndexedDB，只有開機主題用 localStorage。冇分析，冇同步。',
                    )}
                  </small>
                </span>
                <output>{storageError || (ready ? 'Ready' : 'Loading')}</output>
              </div>
              <div
                className="setting-row"
                id="setting-reset-note"
                tabIndex={-1}
              >
                <span>
                  <strong>{L('Recovery and exports', '復原同匯出')}</strong>
                  <small>
                    {L(
                      'Clear this origin’s browser storage to reset local credentials. Ordinary exports omit personal vocabulary, credentials, and authenticator secrets.',
                      '清除呢個來源嘅瀏覽器儲存即可重設本機憑證。普通匯出唔包括個人詞彙、憑證同驗證器秘密。',
                    )}
                  </small>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
