import type { MissionData } from '../data/types';
import { IconArrowLeft, IconArrowRight } from '../components/ui/Icons';
import { useT } from '../i18n/useT';

const STEPS = ['nav.archive', 'nav.story', 'nav.hardware', 'nav.transmission'];

/** Bottom bar: back · four-step progress · chapter label · next. */
export function ChapterNav({
  mission,
  step,
  onPrev,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  mission: MissionData;
  step: number;
  onPrev: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  const t = useT();
  const roman = ['I', 'II', 'III', 'IV'][step];
  return (
    <nav aria-label={t('chapter.nav')} className="chapter-nav">
      <button type="button" className="btn-icon h-12 w-12 shrink-0" onClick={onPrev} aria-label={t('chapter.back', { name: t(STEPS[step - 1] ?? STEPS[0]) })}>
        <IconArrowLeft />
      </button>
      <ol className="chapter-nav__track" aria-label={t('chapter.step', { n: step + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <li key={s} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
            <span className="sr-only">
              {t(s)}
              {i === step ? ` ${t('chapter.current')}` : ''}
            </span>
          </li>
        ))}
      </ol>
      <p className="hidden shrink-0 text-[15px] text-fg-2 md:block">
        {t('chapter.label', { roman })} · {mission.issueTitle}
      </p>
      <button type="button" className="btn-primary shrink-0" onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <IconArrowRight size={18} />
      </button>
    </nav>
  );
}
