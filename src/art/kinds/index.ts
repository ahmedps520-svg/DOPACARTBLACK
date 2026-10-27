import type { ArtKind } from '../../engine/types';
import type { KindFn } from '../kit';
import { electronics } from './electronics';
import { fashion } from './fashion';
import { gaming } from './gaming';
import { lifestyle } from './lifestyle';
import { luxury } from './luxury';
import { fallbackArt } from './fallback';

export const KINDS: Partial<Record<ArtKind, KindFn>> & Record<string, KindFn | undefined> = {
  ...electronics,
  ...fashion,
  ...gaming,
  ...lifestyle,
  ...luxury,
};

export { fallbackArt };
