import { useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, type NarrationRate } from '../../store/useAppStore';
import { LANGUAGES, getLanguage } from '../../i18n/languages';
import { useT } from '../../i18n/useT';
import type { NarrationStatus } from '../../narration/useNarrationPlayer';

const RATES: NarrationRate[] = [0.75, 1, 1.25];

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="narration-switch" onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className="narration-switch__track" aria-hidden="true">
        <span className="narration-switch__thumb" />
      </span>
    </button>
  );
}

/** Voice settings (language, speed, read-along, auto-advance, text only) + the narration live region. */
export function NarrationBar({ status, total }: { status: NarrationStatus; total: number }) {
  const t = useT();
  const { lang, rate, textOnly } = useAppStore(
    useShallow((s) => ({ lang: s.lang, rate: s.rate, textOnly: s.textOnly })),
  );
  const setLang = useAppStore((s) => s.setLang);
  const setNarration = useAppStore((s) => s.setNarration);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const native = getLanguage(lang).nativeName;
  const message =
    status.kind === 'reading'
      ? t('narration.reading', { n: status.panel + 1, total })
      : status.kind === 'paused'
        ? t('narration.paused')
        : status.kind === 'done'
          ? t('narration.done')
          : status.kind === 'unavailable'
            ? t('narration.noVoice', { lang: native })
            : '';

  return (
    <div ref={rootRef} className="narration-bar">
      <p className="sr-only" aria-live="polite" role="status">
        {message}
      </p>
      {open && (
        <div id={panelId} role="group" aria-label={t('narration.settings')} className="narration-panel">
          <fieldset className="narration-panel__row">
            <legend className="narration-panel__label">{t('narration.language')}</legend>
            <div className="narration-panel__options">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  lang={l.bcp47}
                  aria-pressed={l.code === lang}
                  className="narration-chip"
                  onClick={() => setLang(l.code)}
                >
                  {l.nativeName}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="narration-panel__row">
            <legend className="narration-panel__label">{t('narration.speed')}</legend>
            <div className="narration-panel__options">
              {RATES.map((r) => (
                <button key={r} type="button" aria-pressed={r === rate} className="narration-chip" onClick={() => setNarration({ rate: r })}>
                  {r.toLocaleString(getLanguage(lang).numberLocale)}×
                </button>
              ))}
            </div>
          </fieldset>
          <Switch label={t('narration.textOnly')} checked={textOnly} onChange={(v) => setNarration({ textOnly: v })} />
        </div>
      )}
      <button
        ref={btnRef}
        type="button"
        className="narration-toggle"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${t('narration.settings')}: ${native}, ${rate}×`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c-1 4-4 7-7 8" />
          <path d="M13 21l4-9 4 9M14.5 18h5" />
        </svg>
        <span className="narration-toggle__meta" aria-hidden="true">
          <span lang={getLanguage(lang).bcp47}>{lang.toUpperCase()}</span> · {rate}×
        </span>
      </button>
    </div>
  );
}
