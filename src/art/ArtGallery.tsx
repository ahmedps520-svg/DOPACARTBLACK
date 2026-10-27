/**
 * Dev gallery: every ArtKind × a few palettes / finishes / variants.
 * Mounted at a hidden dev route; also used to eyeball the illustrations.
 */
import type { CSSProperties } from 'react';
import type { ArtFinish, ArtKind, ArtSpec } from '../engine/types';
import { ProductArt } from './ProductArt';

/** Exhaustive at compile time: adding an ArtKind without listing it here is a type error. */
const KIND_SET: Record<ArtKind, true> = {
  phone: true, laptop: true, console: true, headphones: true, earbuds: true, camera: true, gpu: true, cpu: true,
  smartwatch: true, tablet: true, speaker: true, drone: true,
  sneaker: true, hoodie: true, jacket: true, tee: true, bag: true, backpack: true, sunglasses: true, cap: true, wallet: true,
  controller: true, headset: true, keyboard: true, mouse: true, monitor: true, chair: true,
  sofa: true, lamp: true, vase: true, candle: true, dumbbell: true, kettlebell: true, bottle: true, figure: true, card: true,
  watch: true, ring: true, perfume: true, trophy: true, pen: true,
};

export const ALL_ART_KINDS = Object.keys(KIND_SET) as ArtKind[];

interface Palette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const GALLERY_PALETTES: Palette[] = [
  { name: 'Obsidian', primary: '#121214', secondary: '#2a2c31', accent: '#3dff9a' },
  { name: 'Ivory', primary: '#ebe5d9', secondary: '#8f7a5c', accent: '#d9a441' },
  { name: 'Crimson', primary: '#b3122b', secondary: '#1c1c20', accent: '#ff7a3d' },
  { name: 'Cobalt', primary: '#2052d8', secondary: '#e9edf4', accent: '#2ee6ff' },
  { name: 'Sage', primary: '#7f9c86', secondary: '#efe9dc', accent: '#f4c24f' },
  { name: 'Violet', primary: '#6b2bd6', secondary: '#15151c', accent: '#ff5fb8' },
];

const FINISHES: ArtFinish[] = ['matte', 'gloss', 'metal', 'gold', 'carbon'];

export interface ArtGalleryProps {
  /** Restrict to some kinds (default: all). */
  kinds?: ArtKind[];
  /** Samples per kind (default 4). */
  samples?: number;
  /** Minimum card width in px (default 180). */
  cell?: number;
}

const styles: Record<string, CSSProperties> = {
  page: { background: '#070708', color: '#e8e6e1', minHeight: '100vh', padding: 24, fontFamily: 'Inter Variable, Inter, system-ui, sans-serif' },
  h1: { margin: '0 0 4px', fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase' },
  sub: { margin: '0 0 24px', opacity: 0.55, fontSize: 13 },
  card: { background: '#0d0d0f', border: '1px solid #1d1d22', borderRadius: 12, overflow: 'hidden' },
  art: { aspectRatio: '1 / 1', width: '100%' },
  label: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', fontSize: 11, letterSpacing: '0.04em', borderTop: '1px solid #1a1a1e' },
  kind: { fontWeight: 600, textTransform: 'uppercase' },
  meta: { opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
};

export function ArtGallery({ kinds = ALL_ART_KINDS, samples = 4, cell = 180 }: ArtGalleryProps): JSX.Element {
  const items: { key: string; spec: ArtSpec; pal: string }[] = [];
  kinds.forEach((kind, ki) => {
    for (let s = 0; s < samples; s++) {
      const pal = GALLERY_PALETTES[(ki + s * 2) % GALLERY_PALETTES.length];
      const finish = FINISHES[(ki + s) % FINISHES.length];
      items.push({
        key: `${kind}-${s}`,
        pal: pal.name,
        spec: { kind, primary: pal.primary, secondary: pal.secondary, accent: pal.accent, finish, variant: s },
      });
    }
  });
  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Product art gallery</h1>
      <p style={styles.sub}>
        {kinds.length} kinds × {samples} samples — palette · finish · variant
      </p>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: `repeat(auto-fill, minmax(${cell}px, 1fr))` }}>
        {items.map(({ key, spec, pal }) => (
          <figure key={key} style={{ ...styles.card, margin: 0 }}>
            <div style={styles.art}>
              <ProductArt spec={spec} title={`${spec.kind} ${pal}`} />
            </div>
            <figcaption style={styles.label}>
              <span style={styles.kind}>{spec.kind}</span>
              <span style={styles.meta}>
                {pal} · {spec.finish} · v{spec.variant}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default ArtGallery;
