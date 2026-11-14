import type { ReactNode } from 'react';
import { StateTrack, TopRight } from './Shell';

/**
 * Shared screen frame: header (kicker + title lockup, status on the right),
 * content, and the roman-numeral state track. Background layers (3D canvas,
 * art) are passed separately so they can bleed under the header.
 */
export function ScreenFrame({
  kicker,
  title,
  status,
  background,
  children,
  footer,
  labelledBy = 'screen-title',
  passthrough = false,
}: {
  kicker: ReactNode;
  title: ReactNode;
  status: ReactNode;
  background?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
  /** Let empty space pass pointer input to a background canvas. */
  passthrough?: boolean;
}) {
  return (
    <section aria-labelledby={labelledBy} className={`screen ${passthrough ? 'screen--passthrough' : ''}`}>
      {background && <div className="screen__bg">{background}</div>}
      <div className="screen__scroll">
        <header className="screen__header">
          <div className="min-w-0">
            <p className="flex items-center gap-4 font-mono text-[11px] tracking-[0.32em] text-fg-2 uppercase">
              {kicker}
              <span aria-hidden="true" className="h-px w-10 bg-[var(--accent)]" />
            </p>
            <h1 id={labelledBy} className="screen__title">
              {title}
            </h1>
          </div>
          <TopRight status={status} />
        </header>
        <div className="screen__body">{children}</div>
        <footer className="screen__footer">{footer ?? <StateTrack />}</footer>
      </div>
    </section>
  );
}

/** Splits a title and sets one word in the accent colour (title-plate treatment). */
export function AccentTitle({ text, index = 1 }: { text: string; index?: number }) {
  const words = text.split(' ');
  const i = Math.min(index, words.length - 1);
  return (
    <>
      {words.map((w, k) => (
        <span key={k} className={k === i ? 'text-[var(--accent)]' : undefined}>
          {w}
          {k < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}
