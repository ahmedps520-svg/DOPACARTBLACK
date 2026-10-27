import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useGame } from '../state/gameStore';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <div className="grow">
            <div className="t-title">{t.title}</div>
            {t.body && <div className="t-body">{t.body}</div>}
            {t.link && (
              <Link to={t.link} className="t-body" style={{ color: 'var(--accent-2)', fontWeight: 600 }} onClick={() => dismiss(t.id)}>
                View →
              </Link>
            )}
          </div>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
