import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ChevronDown, ChevronUp, X, CheckCircle2 } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { TUTORIAL_STEPS } from '../engine/tutorial';
import { skipTutorial, tutorialNext } from '../engine/commands';
import { useAction } from '../lib/hooks';
import { cr } from '../lib/format';

/** Floating, interactive tutorial. Each step completes from real game actions. */
export function TutorialCoach() {
  const tu = useGameState((s) => s.tutorial);
  const cash = useGameState((s) => s.wallet.cash);
  const [collapsed, setCollapsed] = useState(false);
  const { run } = useAction();
  if (!tu.active || tu.done) return null;
  const step = TUTORIAL_STEPS[tu.step];
  if (!step) return null;

  return (
    <aside
      aria-label="Tutorial"
      style={{
        position: 'fixed',
        left: 18,
        bottom: 18,
        zIndex: 90,
        width: 'min(370px, calc(100vw - 24px))',
        background: 'var(--surface-2)',
        border: '1px solid var(--accent-line)',
        borderRadius: 16,
        boxShadow: '0 24px 60px rgba(0,0,0,.55)',
        animation: 'fade-up 240ms var(--ease)',
      }}
      className="tutorial-coach"
    >
      <div className="spread" style={{ padding: '12px 14px', borderBottom: collapsed ? 0 : '1px solid var(--line)' }}>
        <div className="row" style={{ gap: 10 }}>
          <GraduationCap size={18} className="accent" />
          <div>
            <div className="label" style={{ color: 'var(--accent-2)' }}>
              Tutorial · Step {tu.step + 1} of {TUTORIAL_STEPS.length}
            </div>
            <div style={{ fontWeight: 700 }}>{step.title}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand tutorial' : 'Collapse tutorial'}>
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => run((s) => skipTutorial(s), { success: 'Tutorial skipped', successBody: 'Restart it any time from Settings.' })} aria-label="Skip tutorial">
            <X size={16} />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div style={{ padding: '12px 14px 14px' }}>
          <p className="muted" style={{ fontSize: 13 }}>
            {step.body}
          </p>
          {step.id === 'capital' && (
            <div className="num" style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>
              {cr(cash)} <span className="dim" style={{ fontSize: 12 }}>CR (virtual)</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, margin: '12px 0' }}>
            {TUTORIAL_STEPS.map((s, i) => (
              <span key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i < tu.step ? 'var(--accent)' : i === tu.step ? 'var(--accent-2)' : 'var(--surface-3)', opacity: i === tu.step ? 0.6 : 1 }} />
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link to={step.route} className="btn btn-sm">
              {step.routeLabel}
            </Link>
            {step.kind === 'manual' ? (
              <button className="btn btn-sm btn-primary" onClick={() => run((s) => tutorialNext(s), { quiet: true })}>
                <CheckCircle2 size={14} /> Got it
              </button>
            ) : (
              <span className="dim" style={{ fontSize: 11 }}>
                {step.kind === 'visit' ? 'Completes when you open the page' : 'Completes when you do it for real'}
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
