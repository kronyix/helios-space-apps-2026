import type { MissionData } from '../data/types';
import { IconArrowLeft, IconArrowRight } from '../components/ui/Icons';

const STEPS = ['Archive', 'Story', 'Hardware', 'Transmission'];

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
  const roman = ['I', 'II', 'III', 'IV'][step];
  return (
    <nav aria-label="Chapter navigation" className="chapter-nav">
      <button type="button" className="btn-icon h-12 w-12 shrink-0" onClick={onPrev} aria-label={`Back to ${STEPS[step - 1] ?? 'archive'}`}>
        <IconArrowLeft />
      </button>
      <ol className="chapter-nav__track" aria-label={`Step ${step + 1} of 4`}>
        {STEPS.map((s, i) => (
          <li key={s} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
            <span className="sr-only">
              {s}
              {i === step ? ' (current)' : ''}
            </span>
          </li>
        ))}
      </ol>
      <p className="hidden shrink-0 text-[15px] text-fg-2 md:block">
        Chapter {roman} · {mission.issueTitle}
      </p>
      <button type="button" className="btn-primary shrink-0" onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <IconArrowRight size={18} />
      </button>
    </nav>
  );
}
