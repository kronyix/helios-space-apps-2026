import { RULES } from '../engine';
import { usePrediction, useRoverStore } from '../store';
import { CommandIcon, IconTrash, IconUndo } from './icons';
import { formatCommandLabel, formatCommandShort } from './uiStore';

export function PlanStrip() {
  const queue = useRoverStore((s) => s.queue);
  const remove = useRoverStore((s) => s.remove);
  const clear = useRoverStore((s) => s.clear);
  const pred = usePrediction();

  const slots = Array.from({ length: RULES.maxCommands }, (_, i) => queue[i] ?? null);

  return (
    <div className="rd-strip">
      <div className="rd-strip__head">
        <span className="rd-label">
          Sol plan{' '}
          <span className="rd-strip__count" aria-label={`${queue.length} of ${RULES.maxCommands} commands queued`}>
            {queue.length}/{RULES.maxCommands}
          </span>
        </span>
        <div className="rd-strip__tools">
          <button
            type="button"
            className="rd-tool-btn"
            onClick={() => queue.length > 0 && remove(queue.length - 1)}
            disabled={queue.length === 0}
            aria-label="Undo last command"
            title="Undo (Backspace)"
          >
            <IconUndo size={18} />
          </button>
          <button
            type="button"
            className="rd-tool-btn"
            onClick={clear}
            disabled={queue.length === 0}
            aria-label="Clear plan"
            title="Clear plan"
          >
            <IconTrash size={18} />
          </button>
        </div>
      </div>

      <ol className="rd-slots" aria-label="Sol command slots">
        {slots.map((cmd, i) => {
          const isHalted = cmd !== null && pred.haltedAt === i;
          if (!cmd) {
            return (
              <li key={i} className="rd-slot rd-slot--empty" aria-label={`Empty slot ${i + 1}`}>
                <span aria-hidden="true">{i + 1}</span>
              </li>
            );
          }
          return (
            <li key={i} className="rd-slot rd-slot--filled" data-bad={isHalted || undefined}>
              <button
                type="button"
                className="rd-slot__btn"
                onClick={() => remove(i)}
                aria-label={`Remove ${formatCommandLabel(cmd)} from slot ${i + 1}`}
                title={`Tap to remove ${formatCommandLabel(cmd)}`}
              >
                <CommandIcon cmd={cmd} size={18} />
                <span className="rd-slot__val">{formatCommandShort(cmd)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
