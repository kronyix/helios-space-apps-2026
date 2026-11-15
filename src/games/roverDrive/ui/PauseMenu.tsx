import { useEffect, useRef } from 'react';
import type { ExtraGame } from '../../../data/types';
import { setMasterVolume as setAudioMasterVolume } from '../../../lib/audio';
import { useAppStore } from '../../../store/useAppStore';
import { useRoverStore } from '../store';
import { useRoverUiStore } from './uiStore';

interface Props {
  copy: ExtraGame;
  soundOn: boolean;
  onToggleSound: () => void;
  onExit: () => void;
  exitLabel: string;
}

export function PauseMenu({ copy, soundOn, onToggleSound, onExit, exitLabel }: Props) {
  const menu = useRoverStore((s) => s.menu);
  const hud = useRoverStore((s) => s.hud);
  const openMenu = useRoverStore((s) => s.openMenu);
  const toggleHud = useRoverStore((s) => s.toggleHud);
  const restart = useRoverStore((s) => s.restart);
  const openHowTo = useRoverUiStore((s) => s.openHowTo);
  const startTutorial = useRoverUiStore((s) => s.startTutorial);
  const masterVolume = useAppStore((s) => s.masterVolume);
  const setMasterVolume = useAppStore((s) => s.setMasterVolume);
  const hapticsOn = useAppStore((s) => s.hapticsOn);
  const setHapticsOn = useAppStore((s) => s.setHapticsOn);
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menu) resumeRef.current?.focus();
  }, [menu]);

  if (!menu) return null;

  const volPct = Math.round(masterVolume * 100);

  return (
    <div
      className="rd-center rd-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) openMenu(null);
      }}
    >
      <div className="rd-card rd-card--menu" role="dialog" aria-modal="true" aria-label="Game paused">
        <p className="rd-label">Paused</p>
        <h2 className="rd-title">{copy.title}</h2>
        <div className="rd-menu">
          <button ref={resumeRef} type="button" className="rd-send" onClick={() => openMenu(null)}>
            Resume
          </button>
          <button
            type="button"
            className="rd-ghost"
            onClick={() => {
              openMenu(null);
              openHowTo('rules');
            }}
          >
            How to play
          </button>
          <button
            type="button"
            className="rd-ghost"
            onClick={() => {
              openMenu(null);
              startTutorial();
            }}
          >
            Replay tutorial
          </button>
          <button type="button" className="rd-ghost" onClick={toggleHud}>
            {hud ? 'Hide HUD' : 'Show HUD'}
          </button>
          <button type="button" className="rd-ghost" aria-pressed={soundOn} onClick={onToggleSound}>
            {soundOn ? 'Sound: On' : 'Sound: Off'}
          </button>
          <label className="rd-vol-row">
            <span className="rd-vol-row__lbl">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volPct}
              aria-label="Master volume"
              onChange={(e) => {
                const next = Number(e.target.value) / 100;
                setMasterVolume(next);
                setAudioMasterVolume(next);
              }}
            />
            <span className="rd-vol-row__val">{volPct}%</span>
          </label>
          <button type="button" className="rd-ghost" aria-pressed={hapticsOn} onClick={() => setHapticsOn(!hapticsOn)}>
            {hapticsOn ? 'Vibration: On' : 'Vibration: Off'}
          </button>
          <button type="button" className="rd-ghost" onClick={restart}>
            Restart mission
          </button>
          <button type="button" className="rd-ghost" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
