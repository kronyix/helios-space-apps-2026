import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { browserLanguage, DEFAULT_LANG, getLanguage } from '../../i18n/languages';
import { useT } from '../../i18n/useT';

/**
 * One-time offer to switch when the browser prefers a supported language.
 * Never switches by itself; either answer is remembered (langPromptSeen).
 */
export function LangPrompt() {
  const t = useT();
  const seen = useAppStore((s) => s.langPromptSeen);
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const setNarration = useAppStore((s) => s.setNarration);
  const [offer] = useState(browserLanguage);
  if (seen || lang !== DEFAULT_LANG || !offer || offer === DEFAULT_LANG) return null;
  const def = getLanguage(offer);
  const name = def.nativeName;
  return (
    <div className="lang-prompt" role="region" aria-label={t('lang.label')}>
      <p>{t('lang.prompt', { lang: name })}</p>
      <div className="lang-prompt__actions">
        <button type="button" className="btn-primary" lang={def.bcp47} onClick={() => setLang(offer)}>
          {t('lang.switch', { lang: name })}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setNarration({ langPromptSeen: true })}>
          {t('lang.keep')}
        </button>
      </div>
    </div>
  );
}
