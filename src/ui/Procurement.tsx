import { useState } from 'react';
import type { GameState, SupplierId } from '../engine';
import {
  SUPPLIER_IDS,
  loyaltyLabel,
  availableFrom,
  greet,
  industryReport,
  industrySpend,
  inTransit,
  procurementAdvice,
} from '../engine';
import { SUPPLIERS } from '../data/arms2000';
import { Panel, Row } from './bits';

export function Procurement({
  s,
  onOrder,
  onProduction,
}: {
  s: GameState;
  onOrder: (supplier: SupplierId, itemId: string, qty: number) => string | null;
  onProduction: (lineId: string, running: boolean) => void;
}) {
  const [supplier, setSupplier] = useState<SupplierId>('usa');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const greeting = greet(s, supplier);
  const lines = industryReport(s);
  const committed = industrySpend(s);
  const items = availableFrom(s, supplier);
  const transit = inTransit(s);

  return (
    <div className="grid2">
      <div>
        <Panel title="Defence Procurement Office">
          <div className="rows">
            <Row label="Funds available" value={`$${Math.round(s.israel.funds)} M`} tone="amber" />
            <Row label="Monthly budget" value={`$${s.israel.defenceBudget} M`} />
            <Row label="Percentage of G.N.P. on defence" value={`${s.israel.gnpPercent}%`} />
          </div>
          <p className="small dim" style={{ marginTop: 12, marginBottom: 0 }}>
            {procurementAdvice(s)}
          </p>
        </Panel>

        <Panel
          title="Our own industry"
          right={
            committed > 0 ? <span className="mono small">${committed} M / month</span> : undefined
          }
        >
          <p className="small faint" style={{ marginTop: 0 }}>
            Dearer per unit than importing, and nobody else gets a veto over it.
          </p>
          <div className="choices">
            {lines.map((l) => (
              <button
                key={l.id}
                className={`choice${l.running ? ' selected' : ''}`}
                onClick={() => onProduction(l.id, !l.running)}
              >
                <span className="tick">{l.running ? '▸' : ''}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span>{l.name}</span>
                    <span className="mono small faint">
                      ${l.cost} M/mo
                      {l.delivered > 0 ? ` · ${l.delivered} built` : ''}
                    </span>
                  </span>
                  <span className="why" style={{ fontStyle: 'normal' }}>
                    {l.status}. {l.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Suppliers">
          <div className="choices">
            {SUPPLIER_IDS.map((id) => {
              const st = s.israel.suppliers[id];
              return (
                <button
                  key={id}
                  className={`choice${supplier === id ? ' selected' : ''}`}
                  onClick={() => {
                    setSupplier(id);
                    setError(null);
                  }}
                >
                  <span className="tick">{supplier === id ? '▸' : ''}</span>
                  <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {SUPPLIERS[id].name} dealer
                      {st.embargoed ? <span className="pill war"> embargo</span> : null}
                    </span>
                    <span className="mono small faint">{loyaltyLabel(st.loyalty)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        {transit.length > 0 && (
          <Panel title="Awaiting delivery">
            <div className="rows">
              {transit.map((t, i) => (
                <Row
                  key={i}
                  label={`${t.quantity} × ${t.name}`}
                  value={`$${t.cost} M · ${t.eta} mo`}
                />
              ))}
            </div>
          </Panel>
        )}
      </div>

      <Panel title={`Meeting with ${SUPPLIERS[supplier].name} arms dealer`}>
        <p className="small faint" style={{ marginTop: 0 }}>
          {greeting.mood}
        </p>
        <p className="dim" style={{ marginTop: -6 }}>
          {greeting.line}
        </p>

        {!greeting.canTrade || items.length === 0 ? (
          <p className="small faint">No offers made. End meeting.</p>
        ) : (
          <div className="rows">
            {items.map((item) => {
              const q = qty[item.id] ?? 1;
              const affordable = item.cost * q <= s.israel.funds;
              return (
                <div key={item.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="label" style={{ flex: 1 }}>
                    <strong style={{ color: 'var(--text)' }}>{item.name}</strong>
                    <span className="why" style={{ fontStyle: 'normal', display: 'block' }}>
                      {item.description}
                    </span>
                    <span className="mono small faint">
                      ${item.cost} M each · delivery {item.leadTime} mo
                    </span>
                  </span>
                  <span
                    className="value"
                    style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                  >
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={q}
                      onChange={(e) =>
                        setQty({ ...qty, [item.id]: Math.max(1, Number(e.target.value) || 1) })
                      }
                      style={{
                        width: 54,
                        background: 'var(--ink-700)',
                        color: 'var(--text)',
                        border: '1px solid var(--ink-500)',
                        borderRadius: 3,
                        padding: '4px 6px',
                        fontFamily: 'var(--mono)',
                      }}
                    />
                    <button
                      className="btn"
                      disabled={!affordable}
                      onClick={() => setError(onOrder(supplier, item.id, q))}
                    >
                      Buy
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="small red" style={{ marginBottom: 0 }}>
            {error}
          </p>
        )}
      </Panel>
    </div>
  );
}
