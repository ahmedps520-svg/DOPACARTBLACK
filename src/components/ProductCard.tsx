import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Lock, Clock3, GitCompare } from 'lucide-react';
import { ProductArt } from '../art/ProductArt';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { useGame, useGameState } from '../state/gameStore';
import { addToCart, toggleCompare, toggleFavorite } from '../engine/commands';
import { changeOver } from '../engine/history';
import { availableUnits, supplyLevel } from '../engine/market';
import { MINUTES_PER_DAY } from '../engine/constants';
import { rarityUnlockLevel } from '../engine/progression';
import { Change, Credits, RarityTag } from './ui';
import { useAction } from '../lib/hooks';
import { int } from '../lib/format';

/**
 * Memoised studio render of a catalog product (spec objects are static).
 * `lazy` defers drawing until the image nears the viewport, which keeps
 * large grids fast.
 */
export const ProductImage = memo(function ProductImage({ id, backdrop = true, className, lazy }: { id: string; backdrop?: boolean; className?: string; lazy?: boolean }) {
  const def = PRODUCT_BY_ID[id];
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);
  if (!def) return null;
  if (!visible) return <div ref={ref} className="art-placeholder" aria-hidden />;
  return <ProductArt spec={def.art} backdrop={backdrop} title={`${def.name} — fictional product render`} className={className} />;
});

export function ProductThumb({ id, large }: { id: string; large?: boolean }) {
  return (
    <div className={`thumb ${large ? 'thumb-lg' : ''}`}>
      <ProductImage id={id} lazy />
    </div>
  );
}

export const ProductCard = memo(function ProductCard({ id, note, showCompare }: { id: string; note?: React.ReactNode; showCompare?: boolean }) {
  const def = PRODUCT_BY_ID[id];
  const mp = useGameState((s) => s.market[id]);
  const fav = useGameState((s) => s.favorites.includes(id));
  const level = useGameState((s) => s.progression.level);
  const owned = useGameState((s) => s.holdings[id]?.qty ?? 0);
  const comparing = useGameState((s) => s.compare.includes(id));
  const { run } = useAction();
  const toast = useGame((s) => s.toast);
  if (!def || !mp) return null;
  const ch = changeOver(mp, MINUTES_PER_DAY);
  const locked = level < rarityUnlockLevel(def.rarity);
  const avail = availableUnits(mp);
  const sl = supplyLevel(mp);

  return (
    <article className="pcard" style={{ ['--rc' as string]: `var(--r-${def.rarity})` }}>
      <Link to={`/product/${id}`} className="pcard-media" aria-label={def.name}>
        <ProductImage id={id} lazy />
        <div className="pcard-top">
          <div className="pcard-flags">
            {def.limited && <span className="badge badge-accent">Limited</span>}
            {!mp.listed && <span className="badge"><Clock3 size={11} /> Upcoming</span>}
            {mp.listed && (sl === 'Critical' || sl === 'Limited') && <span className="badge badge-warn">{avail === 0 ? 'Sold out' : `${avail} left`}</span>}
            {owned > 0 && <span className="badge badge-up">Own {int(owned)}</span>}
          </div>
        </div>
      </Link>
      <button
        className="pcard-fav"
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 3 }}
        aria-pressed={fav}
        aria-label={fav ? 'Remove from favorites' : 'Save to favorites'}
        onClick={() => run((s) => toggleFavorite(s, id), { quiet: true })}
      >
        <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
      </button>
      {showCompare && mp.listed && (
        <button
          className="pcard-fav"
          style={{ position: 'absolute', top: 48, right: 10, zIndex: 3 }}
          aria-pressed={comparing}
          aria-label={comparing ? 'Remove from comparison' : 'Add to comparison'}
          title={comparing ? 'Remove from comparison' : 'Compare'}
          onClick={() => run((s) => toggleCompare(s, id))}
        >
          <GitCompare size={14} />
        </button>
      )}
      <div className="pcard-body">
        <div className="spread">
          <span className="pcard-brand ellipsis">{def.brand}</span>
          <RarityTag rarity={def.rarity} />
        </div>
        <Link to={`/product/${id}`} className="pcard-name">
          {def.name}
        </Link>
        <div className="pcard-price">
          <Credits value={mp.price} className="price" />
          {mp.listed && <Change value={ch} />}
        </div>
        {note && <div className="pcard-meta">{note}</div>}
        <div className="pcard-actions">
          {locked ? (
            <span className="btn btn-sm btn-ghost" style={{ cursor: 'default' }} title={`Unlocks at level ${rarityUnlockLevel(def.rarity)}`}>
              <Lock size={13} /> Level {rarityUnlockLevel(def.rarity)}
            </span>
          ) : (
            <button
              className="btn btn-sm"
              disabled={!mp.listed || avail === 0}
              onClick={() => {
                const r = run((s) => addToCart(s, id, 1), { sound: 'click' });
                if (r?.ok) toast({ tone: 'success', title: 'Added to cart', body: `${def.name} · ${mp.price.toLocaleString()} CR`, link: '/cart' });
              }}
            >
              <ShoppingCart size={14} /> Add
            </button>
          )}
          <Link to={`/product/${id}`} className="btn btn-sm btn-ghost">
            Details
          </Link>
        </div>
      </div>
      <span className="rarity-line" />
    </article>
  );
});
