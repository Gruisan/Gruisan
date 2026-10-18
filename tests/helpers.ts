import layout from '../config/layout.json';
import { emptySnapshot } from '../src/domain/engine';
import { emplacementsDepuisLayout, type Layout } from '../src/domain/layout';
import type { Article, Snapshot } from '../src/domain/types';

export const LAYOUT = layout as Layout;

export function article(id: string, ref = id, mini = 5): Article {
  return {
    ArticleID: id, Reference: ref, Designation: `Article ${ref}`, Categorie: 'Relais', Constructeur: 'Test',
    Description: '', StockMinimum: mini, Unite: 'pce', Statut: 'actif',
  };
}

/** Magasin vide (240 emplacements du layout) avec deux articles. */
export function magasinVide(): Snapshot {
  return { ...emptySnapshot(), articles: [article('ART-1', 'RL-1'), article('ART-2', 'CT-2')], emplacements: emplacementsDepuisLayout(LAYOUT) };
}

export const E1 = 'A-A01-N01-E01';
export const E2 = 'B-B02-N03-E04';
export const U = 'testeur';
