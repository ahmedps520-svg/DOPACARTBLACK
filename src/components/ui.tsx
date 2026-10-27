import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownRight, ArrowUpRight, Minus, Plus, X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { MarketProduct, Rarity } from '../engine/types';
import { RARITY_LABEL } from '../engine/categories';
import { cr, crSigned, pct, tone } from '../lib/format';
import { demandLevel, supplyLevel, supplyRatio } from '../engine/market';

export function Credits({ value, signed, className, unit = true }: { value: number; signed?: boolean; className?: string; unit?: boolean }) {
  return (
    <span className={`num ${className ?? ''}`}>
      {signed ? crSigned(value) : cr(value)}
      {unit && <span style={{ fontSize: '0.7em', color: 'var(--text-3)', marginLeft: 4, fontWeight: 600 }}>CR</span>}
    </span>
  );
}

export function Change({ value, className, digits = 1, arrow = true }: { value: number; className?: string; digits?: number; arrow?: boolean }) {
  const t = tone(value);
  return (
    <span className={`change ${t} ${className ?? ''}`}>
      {arrow && t === 'up' && <ArrowUpRight size={13} strokeWidth={2.5} />}
      {arrow && t === 'down' && <ArrowDownRight size={13} strokeWidth={2.5} />}
      {pct(value, digits)}
    </span>
  );
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return <span className={`rarity rarity-${rarity}`}>{RARITY_LABEL[rarity]}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  size,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'lg';
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="modal-head">
          <div>
            {kicker && <div className="label" style={{ color: 'var(--accent-2)', marginBottom: 6 }}>{kicker}</div>}
            <h2 id={id}>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function QtyInput({ value, onChange, min = 1, max, label = 'Quantity' }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }) {
  const clamp = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n);
  return (
    <div className="input-group" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease">
        <Minus size={14} />
      </button>
      <input
        className="input"
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10);
          onChange(clamp(n));
        }}
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={max !== undefined && value >= max} aria-label="Increase">
        <Plus size={14} />
      </button>
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <div style={{ maxWidth: 420 }}>{children}</div>}
      {action}
    </div>
  );
}

export function Stat({ label, children, foot, icon, large }: { label: ReactNode; children: ReactNode; foot?: ReactNode; icon?: ReactNode; large?: boolean }) {
  return (
    <div className="stat">
      <div className="lbl">
        {icon}
        {label}
      </div>
      <div className={`val ${large ? 'lg' : ''}`}>{children}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Notice({ tone: t = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'up'; children: ReactNode }) {
  const Icon = t === 'warn' ? AlertTriangle : t === 'error' ? AlertTriangle : t === 'up' ? CheckCircle2 : Info;
  return (
    <div className={`notice notice-${t}`}>
      <Icon size={16} />
      <div>{children}</div>
    </div>
  );
}

const DEMAND_COLOR: Record<string, string> = {
  Weak: 'var(--down)',
  Soft: 'var(--warn)',
  Steady: 'var(--text-2)',
  Strong: 'var(--up)',
  Surging: 'var(--up)',
};
const SUPPLY_COLOR: Record<string, string> = {
  Critical: 'var(--down)',
  Limited: 'var(--warn)',
  Tight: 'var(--warn)',
  Healthy: 'var(--text-2)',
  Abundant: 'var(--info)',
};

export function Bars({ n, of = 5, color }: { n: number; of?: number; color: string }) {
  return (
    <span className="level-bars" style={{ color }} aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} style={{ height: 5 + i * 2.5 }} />
      ))}
    </span>
  );
}

export function DemandIndicator({ mp, compact }: { mp: MarketProduct; compact?: boolean }) {
  const lvl = demandLevel(mp);
  const n = { Weak: 1, Soft: 2, Steady: 3, Strong: 4, Surging: 5 }[lvl];
  return (
    <span className="row" style={{ gap: 6 }} title={`Demand index ${Math.round(mp.demand)} (100 = normal)`}>
      <Bars n={n} color={DEMAND_COLOR[lvl]} />
      <span style={{ fontSize: 12, color: DEMAND_COLOR[lvl], fontWeight: 600 }}>{compact ? lvl : `${lvl} · ${Math.round(mp.demand)}`}</span>
    </span>
  );
}

export function SupplyIndicator({ mp, compact }: { mp: MarketProduct; compact?: boolean }) {
  const lvl = supplyLevel(mp);
  const n = { Critical: 1, Limited: 2, Tight: 3, Healthy: 4, Abundant: 5 }[lvl];
  return (
    <span className="row" style={{ gap: 6 }} title={`${Math.floor(mp.supply)} units on market (${Math.round(supplyRatio(mp) * 100)}% of normal)`}>
      <Bars n={n} color={SUPPLY_COLOR[lvl]} />
      <span style={{ fontSize: 12, color: SUPPLY_COLOR[lvl], fontWeight: 600 }}>{compact ? lvl : `${lvl} · ${Math.floor(mp.supply)}`}</span>
    </span>
  );
}

export function Meter({ value, max, tone: t }: { value: number; max: number; tone?: 'up' | 'gold' | 'warn' }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter ${t ?? ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <span style={{ width: `${w}%` }} />
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
  disabled,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={disabled}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export function VirtualNote({ children }: { children?: ReactNode }) {
  return (
    <span className="virtual-note">
      <Info size={12} />
      {children ?? 'Virtual game currency — no real money, products or deliveries.'}
    </span>
  );
}
