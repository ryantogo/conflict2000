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

export function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="row">
      <span className="label">{label}</span>
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

export function Bar({ value, tone }: { value: number; tone?: 'teal' | 'red' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Centre-anchored war progress bar: left is losing, right is winning. */
export function WarBar({ progress }: { progress: number }) {
  const p = Math.max(-100, Math.min(100, progress));
  const half = Math.abs(p) / 2;
  return (
    <div className="warbar">
      <div
        className={`fill${p < 0 ? ' losing' : ''}`}
        style={p < 0 ? { right: '50%', width: `${half}%` } : { left: '50%', width: `${half}%` }}
      />
      <div className="mid" />
    </div>
  );
}
