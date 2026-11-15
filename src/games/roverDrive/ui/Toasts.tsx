import { useEffect } from 'react';
import { IconClose } from '../../../components/ui/Icons';
import { useAppStore } from '../../../store/useAppStore';
import { tiltWarnBeep, triggerHaptic } from '../../../lib/audio';
import { RULES } from '../engine';
import { poseAt, useRoverStore } from '../store';
import { IconDust, IconRock, IconSand, IconSlope, IconWarning } from './icons';
import { getExecProgress, useRoverUiStore, type ToastKind } from './uiStore';

const TOAST_TTL_MS = 3000;

function ToastIcon({ kind }: { kind: ToastKind }) {
  switch (kind) {
    case 'tilt':
      return <IconSlope size={17} />;
    case 'sand':
      return <IconSand size={17} />;
    case 'rock':
      return <IconRock size={17} />;
    case 'dust':
      return <IconDust size={17} />;
    default:
      return <IconWarning size={17} />;
  }
}

export function Toasts() {
  const toasts = useRoverUiStore((s) => s.toasts);
  const pushToast = useRoverUiStore((s) => s.pushToast);
  const dismissToast = useRoverUiStore((s) => s.dismissToast);
  const phase = useRoverStore((s) => s.phase);
  const report = useRoverStore((s) => s.report);
  const rover = useRoverStore((s) => s.game.rover);

  // Tilt & dust alert toasts (sand/rock/battery are handled by the Mission Control Captions stream).
  useEffect(() => {
    if (phase === 'executing') {
      const id = window.setInterval(() => {
        const st = useRoverStore.getState();
        if (st.phase !== 'executing' || !st.report) return;
        const p = poseAt(st.report.actual.path, st.timeline, getExecProgress(st));
        if (p.tilt > RULES.tiltWarnDeg) {
          const already = !!useRoverUiStore.getState().shownToasts.tilt;
          pushToast('tilt', 'Tilt over 20° — watch the slope!', 'warn');
          if (!already) {
            tiltWarnBeep();
            triggerHaptic('tilt', useAppStore.getState().hapticsOn);
          }
        }
      }, 220);
      return () => window.clearInterval(id);
    }

    if (phase !== 'downlink' || !report) return;
    const evs = report.actual.events;

    if (evs.includes('tilt_warning') || evs.includes('tilt_stop')) {
      const already = !!useRoverUiStore.getState().shownToasts.tilt;
      pushToast('tilt', 'Slope over 20° — watch your balance.', 'warn');
      if (!already) {
        tiltWarnBeep();
        triggerHaptic('tilt', useAppStore.getState().hapticsOn);
      }
    }

    // Derived from rover.dust & recharge reduction (engine has no separate dust SimEvent).
    if (
      report.sol >= 2 &&
      rover.dust >= RULES.dustPerSol &&
      report.batteryAfterRecharge > report.batteryAfterDrive &&
      report.batteryAfterRecharge < 100
    ) {
      pushToast('dust', 'Dust on panels cut overnight recharge.', 'info');
    }
  }, [phase, report, rover.dust, pushToast]);

  // Auto-dismiss each toast after 3s.
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismissToast(t.id), TOAST_TTL_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  if (!toasts.length) return null;

  return (
    <div className="rd-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className="rd-toast" data-tone={t.tone} role="status">
          <span className="rd-toast__ico" aria-hidden="true">
            <ToastIcon kind={t.kind} />
          </span>
          <span className="rd-toast__txt">{t.text}</span>
          <button
            type="button"
            className="rd-toast__close"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
          >
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
