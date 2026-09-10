import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Panel({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>
        {title}
        {right ? <span style={{ float: 'right', opacity: 0.8 }}>{right}</span> : null}
      </h2>
      <div className="body">{children}</div>
    </section>
  );
}

export function Row({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  /** What this number actually means, and what moves it. */
  hint?: string;
}) {
  return (
    <div className="row">
      <span className="label">{hint ? <Tip text={hint}>{label}</Tip> : label}</span>
      <span className={`value ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

export interface ChoiceItem<T extends string> {
  id: T;
  label: string;
  disabledReason?: string;
}

export function Choices<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: ChoiceItem<T>[];
  selected?: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="choices">
      {options.map((o, i) => {
        const disabled = !!o.disabledReason;
        const isSelected = selected === o.id && !disabled;
        return (
          <button
            key={`${o.id}-${i}`}
            className={`choice${isSelected ? ' selected' : ''}`}
            disabled={disabled}
            onClick={() => onSelect(o.id)}
          >
            <span className="tick">{isSelected ? '▸' : ''}</span>
            <span>
              {o.label}
              {o.disabledReason ? <span className="why">{o.disabledReason}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Bar({
  value,
  tone,
  label,
}: {
  value: number;
  tone?: 'teal' | 'red';
  /** What is being measured. A bar whose value exists only as a CSS width
      says nothing at all to a screen reader. */
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`bar ${tone ?? ''}`}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(label ? { 'aria-label': label } : {})}
    >
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/** Centre-anchored war progress bar: left is losing, right is winning. */
export function WarBar({ progress }: { progress: number }) {
  const p = Math.max(-100, Math.min(100, progress));
  const half = Math.abs(p) / 2;
  return (
    <div
      className="warbar"
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-label="Fortunes of war"
    >
      <div
        className={`fill${p < 0 ? ' losing' : ''}`}
        style={p < 0 ? { right: '50%', width: `${half}%` } : { left: '50%', width: `${half}%` }}
      />
      <div className="mid" />
    </div>
  );
}

/** Space kept between a tooltip and the anchor it explains, and the screen edge. */
const TIP_GAP = 8;
const TIP_MARGIN = 8;

/**
 * A hover explanation, revealed on hover and on keyboard focus. Explaining a
 * rule to somebody who cannot use a mouse is not an optional part of
 * explaining it.
 *
 * The body is portalled to the document and positioned against the viewport.
 * It used to be an absolutely positioned child of whatever it annotated, and
 * every panel clips its contents to its rounded corners — so a tip opening
 * upward out of a panel, and above all one in a panel's own header, was cut
 * off by the box it was explaining.
 *
 * Tooltips say what the rule is. They never print the number behind it — see
 * the first principle in DESIGN.md.
 */
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const id = useId();

  // Measure after the body has rendered invisibly, then place it: above the
  // anchor if it fits, below it if not, and never past either side of the screen.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const a = anchor.current?.getBoundingClientRect();
    const b = body.current?.getBoundingClientRect();
    if (!a || !b) return;
    let top = a.top - b.height - TIP_GAP;
    if (top < TIP_MARGIN) top = a.bottom + TIP_GAP;
    const maxLeft = window.innerWidth - b.width - TIP_MARGIN;
    const left = Math.max(TIP_MARGIN, Math.min(a.left, maxLeft));
    setPos({ left, top });
  }, [open, text]);

  // A fixed layer does not follow its anchor, so anything that moves the page
  // puts the tip away rather than leaving it floating over the wrong thing.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span
      ref={anchor}
      className="tip"
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={body}
            id={id}
            className="tip-body"
            role="tooltip"
            style={
              pos
                ? { left: pos.left, top: pos.top }
                : { left: 0, top: 0, visibility: 'hidden' }
            }
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

export interface SubTabItem<T extends string> {
  id: T;
  label: string;
  /**
   * One sentence saying what this view is for, shown beneath the strip. The
   * map's mode switcher has carried one of these since the first commit and it
   * is the reason that screen explains itself and the others do not.
   */
  legend: string;
  /** Something needs attention in here. */
  dot?: boolean;
}

/**
 * A switcher inside a screen. Never put the thing the player acts with behind
 * one of these — tab what they read, not what they do.
 */
export function SubTabs<T extends string>({
  items,
  selected,
  onSelect,
}: {
  items: SubTabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  const current = items.find((i) => i.id === selected) ?? items[0];

  return (
    <>
      <div className="tabs sub" role="tablist">
        {items.map((i) => (
          <button
            key={i.id}
            role="tab"
            aria-selected={selected === i.id}
            className={`tab${selected === i.id ? ' active' : ''}`}
            onClick={() => onSelect(i.id)}
          >
            {i.label}
            {i.dot ? <span className="dot" /> : null}
          </button>
        ))}
      </div>
      {current?.legend ? <p className="map-legend">{current.legend}</p> : null}
    </>
  );
}
