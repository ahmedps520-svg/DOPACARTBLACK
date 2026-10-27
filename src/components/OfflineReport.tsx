import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useGame } from '../state/gameStore';
import { Credits, Modal, Notice } from './ui';
import { formatDuration } from '../engine/time';

export function OfflineReportModal() {
  const r = useGame((s) => s.offline);
  const close = useGame((s) => s.dismissOffline);
  if (!r) return null;
  return (
    <Modal
      open
      onClose={close}
      kicker={<span className="row"><Clock size={12} /> While you were away</span>}
      title={`${formatDuration(r.minutes)} of market time passed`}
      footer={
        <button className="btn btn-primary" onClick={close}>
          Back to business
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 14 }}>
        The simulation kept running at your chosen speed. Deliveries, store sales, prices and events below are real results of that time.
      </p>
      {r.capped && <Notice tone="warn">You were away longer than the 7-day catch-up limit, so only the most recent 7 in-game days were simulated.</Notice>}
      <dl className="kv" style={{ marginTop: 14 }}>
        <dt>Cash change</dt>
        <dd>
          <Credits value={r.cashDelta} signed className={r.cashDelta >= 0 ? 'up' : 'down'} />
        </dd>
        <dt>Net worth change</dt>
        <dd>
          <Credits value={r.netWorthDelta} signed className={r.netWorthDelta >= 0 ? 'up' : 'down'} />
        </dd>
        <dt>Units sold by your stores</dt>
        <dd>{r.storeUnits}</dd>
        <dt>Supplier orders delivered</dt>
        <dd>{r.deliveredOrders.length}</dd>
        <dt>Price alerts triggered</dt>
        <dd>{r.alerts}</dd>
      </dl>
      {r.newEvents.length > 0 && (
        <>
          <div className="divider" />
          <div className="label" style={{ marginBottom: 8 }}>Market events</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: 13 }}>
            {r.newEvents.slice(0, 6).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <Link to="/news" className="btn btn-sm btn-ghost" style={{ marginTop: 10 }} onClick={close}>
            Open the Newsroom
          </Link>
        </>
      )}
    </Modal>
  );
}
