import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import mappingJson from '../config/import-mapping.json';
import demo from '../src/data/demo-data.json';
import { classeurVersOctets, exporterClasseur, importerClasseur, lireClasseur, validerMapping, type MappingImport } from '../src/domain/excel';
import { applyMouvement } from '../src/domain/engine';
import type { Snapshot } from '../src/domain/types';
import { E1, LAYOUT, U } from './helpers';
import { emplacementsDepuisLayout } from '../src/domain/layout';

const MAPPING = validerMapping(mappingJson);
const DEMO = demo as Snapshot;

/** Export → octets .xlsx → relecture → import. */
function allerRetour(s: Snapshot, mapping: MappingImport = MAPPING) {
  const octets = classeurVersOctets(exporterClasseur(s, mapping));
  return importerClasseur(lireClasseur(octets), mapping);
}

/** Modifie une feuille du classeur exporté (tableau de tableaux) puis relit. */
function classeurModifie(s: Snapshot, feuille: string, f: (aoa: unknown[][]) => void) {
  const wb = lireClasseur(classeurVersOctets(exporterClasseur(s, MAPPING)));
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[feuille], { header: 1, raw: true, defval: null });
  f(aoa);
  wb.Sheets[feuille] = XLSX.utils.aoa_to_sheet(aoa);
  return lireClasseur(classeurVersOctets(wb));
}

describe('Import / export Excel', () => {
  it('export puis réimport donne des données identiques (jeu de démo complet)', () => {
    const r = allerRetour(DEMO);
    expect(r.erreursBloquantes).toEqual([]);
    expect(r.rejets).toEqual([]);
    expect(r.bloquant).toBe(false);
    expect(r.snapshot).toEqual(DEMO);
  });

  it('aller-retour identique après des mouvements (stand-by, ajustement, champs optionnels)', () => {
    let s = DEMO;
    const st = s.stocks[0];
    for (const m of [
      { Type: 'AJUSTEMENT' as const, ArticleID: st.ArticleID, EmplacementDestination: st.EmplacementID, Quantite: st.Quantite + 2, Utilisateur: U, Commentaire: 'Comptage ; « guillemets », accents éèà' },
      { Type: 'ENTREE' as const, ArticleID: 'ART-0001', EmplacementDestination: E1, Quantite: 3, Utilisateur: U },
    ]) {
      const r = applyMouvement(s, m);
      if (!r.ok) throw new Error(r.error);
      s = r.snapshot;
    }
    expect(allerRetour(s).snapshot).toEqual(s);
  });

  it('aller-retour avec des en-têtes personnalisés (mapping SharePoint)', () => {
    const perso = structuredClone(MAPPING);
    perso.tables.articles.feuille = 'Liste Articles';
    perso.tables.articles.colonnes.Reference = 'Réf. constructeur';
    perso.tables.stocks.colonnes.Quantite = 'Qté';
    const wb = exporterClasseur(DEMO, perso);
    expect(wb.SheetNames).toContain('Liste Articles');
    expect(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Liste Articles'], { header: 1 })[0]).toContain('Réf. constructeur');
    expect(allerRetour(DEMO, perso).snapshot).toEqual(DEMO);
  });

  it('une référence inconnue est rejetée et listée', () => {
    const wb = classeurModifie(DEMO, 'STOCKS', (aoa) => {
      aoa.push(['S-X', 'REF-INEXISTANTE', E1, 5, 1, '2026-10-01T08:00:00.000Z']);
    });
    const r = importerClasseur(wb, MAPPING);
    expect(r.rejets).toHaveLength(1);
    expect(r.rejets[0]).toMatchObject({ feuille: 'STOCKS', ligne: DEMO.stocks.length + 2, valeur: 'REF-INEXISTANTE' });
    expect(r.rejets[0].raison).toMatch(/Référence inconnue : REF-INEXISTANTE/);
    expect(r.compte.stocks).toEqual({ lues: DEMO.stocks.length + 1, acceptees: DEMO.stocks.length, rejetees: 1 });
    // Rejet non bloquant par défaut : le reste est importable, sans la ligne rejetée.
    expect(r.bloquant).toBe(false);
    expect(r.snapshot!.stocks).toEqual(DEMO.stocks);
  });

  it('avec rejetsBloquants, la moindre ligne rejetée bloque tout : aucun snapshot produit', () => {
    const wb = classeurModifie(DEMO, 'MOUVEMENTS', (aoa) => {
      aoa[3][3] = 'ZZ-0000';
    });
    const r = importerClasseur(wb, { ...MAPPING, options: { rejetsBloquants: true } });
    expect(r.bloquant).toBe(true);
    expect(r.snapshot).toBeUndefined();
    expect(r.rejets[0]).toMatchObject({ feuille: 'MOUVEMENTS', ligne: 4 });
  });

  it('erreurs bloquantes : feuille absente, colonne obligatoire absente, clé en double', () => {
    const wb1 = lireClasseur(classeurVersOctets(exporterClasseur(DEMO, MAPPING)));
    wb1.SheetNames = wb1.SheetNames.filter((n) => n !== 'EMPLACEMENTS');
    const r1 = importerClasseur(wb1, MAPPING);
    expect(r1.bloquant).toBe(true);
    expect(r1.erreursBloquantes[0].raison).toMatch(/EMPLACEMENTS.*absente/);
    expect(r1.snapshot).toBeUndefined();

    const r2 = importerClasseur(classeurModifie(DEMO, 'ARTICLES', (aoa) => aoa.forEach((l) => l.splice(1, 1))), MAPPING);
    expect(r2.bloquant).toBe(true);
    expect(r2.erreursBloquantes.map((e) => e.raison).join()).toMatch(/Colonne obligatoire « Reference »/);

    const r3 = importerClasseur(classeurModifie(DEMO, 'ARTICLES', (aoa) => aoa.push([...aoa[1]])), MAPPING);
    expect(r3.bloquant).toBe(true);
    expect(r3.erreursBloquantes[0].raison).toMatch(/ArticleID en double/);
  });

  it('valeurs invalides rejetées avec la raison, ligne et colonne', () => {
    const wb = classeurModifie(DEMO, 'STOCKS', (aoa) => {
      aoa[1][3] = 'douze';
      aoa[2][3] = -4;
      aoa[3][2] = 'Z-Z99-N01-E01';
    });
    const r = importerClasseur(wb, MAPPING);
    expect(r.rejets.map((x) => [x.ligne, x.colonne, x.raison])).toEqual([
      [2, 'Quantite', 'Quantite doit être un nombre entier.'],
      [3, 'Quantite', 'Quantite doit être ≥ 0.'],
      [4, 'EmplacementID', 'Emplacement inconnu : Z-Z99-N01-E01.'],
    ]);
  });

  it('accepte une référence à la place de l’ArticleID, des nombres « 12,0 » et des dates Excel', () => {
    const a = DEMO.articles[0];
    const wb = classeurModifie(DEMO, 'STOCKS', (aoa) => {
      aoa.length = 1;
      aoa.push(['', a.Reference, E1, '12,0', null, new Date(Date.UTC(2026, 9, 1, 8))]);
    });
    const r = importerClasseur(wb, MAPPING);
    expect(r.rejets).toEqual([]);
    expect(r.snapshot!.stocks).toEqual([{ StockID: `S-${a.ArticleID}-${E1}`, ArticleID: a.ArticleID, EmplacementID: E1, Quantite: 12, Version: 1, DateModification: '2026-10-01T08:00:00.000Z' }]);
  });

  it('signale les emplacements hors géométrie', () => {
    const r = importerClasseur(lireClasseur(classeurVersOctets(exporterClasseur(DEMO, MAPPING))), MAPPING, {
      emplacementsLayout: emplacementsDepuisLayout(LAYOUT).map((e) => e.EmplacementID).slice(1),
    });
    expect(r.avertissements.join()).toMatch(/1 emplacement\(s\) absent\(s\) de la géométrie/);
  });

  it('valide le mapping', () => {
    const m = structuredClone(MAPPING) as MappingImport;
    delete (m.tables.stocks.colonnes as Record<string, string>).Quantite;
    expect(() => validerMapping(m)).toThrow(/stocks\.Quantite/);
    const m2 = structuredClone(MAPPING);
    m2.tables.articles.colonnes.Designation = 'Reference';
    expect(() => validerMapping(m2)).toThrow(/même colonne/);
  });
});

describe('Fichiers réels', () => {
  it('le classeur de démo versionné se réimporte à l’identique', async () => {
    const { readFileSync } = await import('node:fs');
    const r = importerClasseur(lireClasseur(readFileSync('data/INVENTAIRE_MAGASIN_DEMO.xlsx')), MAPPING);
    expect(r.rejets).toEqual([]);
    expect(r.snapshot).toEqual(DEMO);
  });

  it('un classeur réenregistré par un autre outil (openpyxl) : référence inconnue rejetée et listée', async () => {
    const { readFileSync } = await import('node:fs');
    const r = importerClasseur(lireClasseur(readFileSync('tests/fixtures/inventaire_modifie_openpyxl.xlsx')), MAPPING);
    expect(r.erreursBloquantes).toEqual([]);
    expect(r.rejets).toEqual([
      { feuille: 'STOCKS', ligne: DEMO.stocks.length + 2, colonne: 'ArticleID', valeur: 'REF-INCONNUE-42', raison: 'Référence inconnue : REF-INCONNUE-42.' },
    ]);
    expect(r.snapshot!.stocks[0].Quantite).toBe(5);
    expect(r.snapshot!.articles).toEqual(DEMO.articles);
    expect(r.snapshot!.mouvements).toEqual(DEMO.mouvements);
  });
});
