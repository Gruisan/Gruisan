import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import layout from '../config/layout.json';
import demo from '../src/data/demo-data.json';
import { genererDemo } from '../src/domain/demoGenerator';
import { stockDisponible } from '../src/domain/engine';
import type { Layout } from '../src/domain/layout';
import type { Snapshot } from '../src/domain/types';
import { LocalDemoProvider } from '../src/providers/LocalDemoProvider';
import { memoryStore, ouvrirIndexedDB } from '../src/providers/storage';
import { E1, U, magasinVide } from './helpers';

describe('LocalDemoProvider', () => {
  it('persiste les mouvements et les retrouve après « réouverture »', async () => {
    const store = await ouvrirIndexedDB();
    const p1 = new LocalDemoProvider({ demo: magasinVide, store });
    await p1.init();
    const r = await p1.appliquerMouvement({ Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 9, Utilisateur: U });
    expect(r.ok).toBe(true);
    const p2 = new LocalDemoProvider({ demo: magasinVide, store: await ouvrirIndexedDB() });
    const s = await p2.init();
    expect(stockDisponible(s, 'ART-1')).toBe(9);
    expect(s.mouvements).toHaveLength(1);
    expect(p2.statut().persistance).toBe('indexeddb');
  });

  it('un UUID rejoué via le provider ne crée pas de doublon', async () => {
    const p = new LocalDemoProvider({ demo: magasinVide, store: memoryStore() });
    await p.init();
    const m = { MouvementID: '11111111-2222-4333-8444-555555555555', Type: 'ENTREE' as const, ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 2, Utilisateur: U };
    await p.appliquerMouvement(m);
    const r2 = await p.appliquerMouvement(m);
    expect(r2.ok && r2.duplicate).toBe(true);
    expect(p.getSnapshot().mouvements).toHaveLength(1);
  });

  it("un échec de sauvegarde n'altère pas les données", async () => {
    const store = memoryStore();
    const p = new LocalDemoProvider({ demo: magasinVide, store });
    await p.init();
    store.set = async () => {
      throw new Error('disque plein');
    };
    const r = await p.appliquerMouvement({ Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 2, Utilisateur: U });
    expect(r.ok).toBe(false);
    expect(p.getSnapshot().mouvements).toHaveLength(0);
  });

  it('export puis import JSON redonne les mêmes données', async () => {
    const p = new LocalDemoProvider({ demo: () => demo as Snapshot, store: memoryStore() });
    await p.init();
    const json = p.exporterJson();
    const q = new LocalDemoProvider({ demo: magasinVide, store: memoryStore() });
    await q.init();
    expect(await q.importerJson(json)).toEqual(p.getSnapshot());
  });
});

describe('Jeu de démonstration', () => {
  it('est déterministe et identique au fichier versionné', () => {
    const g = genererDemo(layout as Layout);
    expect(JSON.parse(JSON.stringify(g))).toEqual(demo);
  });

  it('respecte le cahier des charges (240 emplacements, 120 articles, multi-emplacements, ruptures, sous-seuils)', () => {
    const s = demo as Snapshot;
    expect(s.emplacements).toHaveLength(240);
    expect(s.articles).toHaveLength(120);
    expect(new Set(s.articles.map((a) => a.Categorie)).size).toBe(15);
    const nbEmp = new Map<string, number>();
    for (const x of s.stocks) nbEmp.set(x.ArticleID, (nbEmp.get(x.ArticleID) ?? 0) + 1);
    expect([...nbEmp.values()].filter((n) => n > 1).length).toBeGreaterThan(5);
    const dispo = (id: string) => stockDisponible(s, id);
    expect(s.articles.filter((a) => dispo(a.ArticleID) === 0).length).toBeGreaterThan(2);
    expect(s.articles.filter((a) => dispo(a.ArticleID) > 0 && dispo(a.ArticleID) < a.StockMinimum).length).toBeGreaterThan(2);
    expect(s.emplacements[0].EmplacementID).toMatch(/^[A-F]-[A-F]\d{2}-N\d{2}-E\d{2}$/);
    expect(s.stocks.every((x) => x.Quantite > 0)).toBe(true);
  });
});
