import type { ReactNode } from 'react';

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

/**
 * A hover explanation. There is no tooltip anywhere else in this game, and no
 * library to reach for, so this is CSS only: a `:hover` and `:focus-visible`
 * reveal on a wrapper that is reachable by keyboard. Explaining a rule to
 * somebody who cannot use a mouse is not an optional part of explaining it.
 *
 * Tooltips say what the rule is. They never print the number behind it — see
 * the first principle in DESIGN.md.
 */
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="tip" tabIndex={0}>
      {children}
      <span className="tip-body" role="tooltip">
        {text}
      </span>
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
