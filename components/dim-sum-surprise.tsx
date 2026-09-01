'use client';

import { useEffect, useState } from 'react';
import { useVisitorState } from '@/components/visitor-state-provider';
import { releaseCodeName } from '@/data/changelog';
import { shouldShowDimSumSurprise } from '@/lib/dim-sum';
import { localize } from '@/lib/i18n';

export function DimSumSurprise() {
  const { state, text } = useVisitorState();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.settings.schoolMode.enabled) {
        setVisible(false);
        return;
      }
      const seen = localStorage.getItem('nazca.boot.seen');
      localStorage.setItem('nazca.boot.seen', '1');
      if (!seen) return;
      const random = crypto.getRandomValues(new Uint32Array(1))[0];
      if (
        !shouldShowDimSumSurprise({
          hasSeen: !!seen,
          schoolMode: false,
          randomUint32: random,
        })
      )
        return;
      setVisible(true);
    }, 0);
    const dismissal = setTimeout(() => setVisible(false), 9000);
    return () => {
      clearTimeout(timer);
      clearTimeout(dismissal);
    };
  }, [state.settings.schoolMode.enabled]);

  if (!visible || state.settings.schoolMode.enabled) return null;
  const language = state.settings.languageMode;
  const message = text(
    localize(
      state.settings.funnyLevelEnglish === 1
        ? 'A dim sum dish from the public catalog.'
        : 'A tiny steamer basket rolled into the station.',
      state.settings.funnyLevelCantonese === 1
        ? '公共目錄嘅點心。'
        : '有籠點心啱啱碌咗入站。',
      language,
    ),
  );
  return (
    <output className="dim-sum-surprise" aria-label="Dim sum surprise">
      <object
        data={releaseCodeName.assetUrl}
        type="image/png"
        aria-label="Classic Har Gow, four translucent shrimp dumplings in a bamboo steamer"
      />
      <div>
        <strong>
          {releaseCodeName.en} · {releaseCodeName.zhHant}
        </strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={() => setVisible(false)}>
        Dismiss
      </button>
    </output>
  );
}
