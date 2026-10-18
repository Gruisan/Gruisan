// Index et indicateurs dérivés d'un Snapshot (calculés, jamais stockés).

import { quantiteStandbyRestante } from './engine';
import type { Article, Emplacement, Mouvement, Snapshot, Stock } from './types';

export interface Index {
  articleParId: Map<string, Article>;
  emplacementParId: Map<string, Emplacement>;
  stocksParEmplacement: Map<string, Stock[]>;
  stocksParArticle: Map<string, Stock[]>;
  quantiteParEmplacement: Map<string, number>;
  disponibleParArticle: Map<string, number>;
  standbyParArticle: Map<string, number>;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const l = m.get(k);
  if (l) l.push(v);
  else m.set(k, [v]);
}

export function construireIndex(s: Snapshot): Index {
  const idx: Index = {
    articleParId: new Map(s.articles.map((a) => [a.ArticleID, a])),
    emplacementParId: new Map(s.emplacements.map((e) => [e.EmplacementID, e])),
    stocksParEmplacement: new Map(),
    stocksParArticle: new Map(),
    quantiteParEmplacement: new Map(),
    disponibleParArticle: new Map(),
    standbyParArticle: new Map(),
  };
  for (const st of s.stocks) {
    push(idx.stocksParEmplacement, st.EmplacementID, st);
    push(idx.stocksParArticle, st.ArticleID, st);
    idx.quantiteParEmplacement.set(st.EmplacementID, (idx.quantiteParEmplacement.get(st.EmplacementID) ?? 0) + st.Quantite);
    idx.disponibleParArticle.set(st.ArticleID, (idx.disponibleParArticle.get(st.ArticleID) ?? 0) + st.Quantite);
  }
  for (const sb of s.standbys) {
    if (sb.Statut !== 'ouvert') continue;
    idx.standbyParArticle.set(sb.ArticleID, (idx.standbyParArticle.get(sb.ArticleID) ?? 0) + quantiteStandbyRestante(sb));
  }
  return idx;
}

export function tauxOccupation(idx: Index, emplacementId: string): number {
  const e = idx.emplacementParId.get(emplacementId);
  if (!e || e.Capacite <= 0) return 0;
  return (idx.quantiteParEmplacement.get(emplacementId) ?? 0) / e.Capacite;
}

export type EtatArticle = 'rupture' | 'sous-seuil' | 'ok';

export function etatArticle(idx: Index, a: Article): EtatArticle {
  const d = idx.disponibleParArticle.get(a.ArticleID) ?? 0;
  if (d <= 0) return 'rupture';
  if (d < a.StockMinimum) return 'sous-seuil';
  return 'ok';
}

export interface StatsRayonnage {
  rayonnageId: string;
  zone: string;
  nbEmplacements: number;
  nbEmplacementsOccupes: number;
  nbReferences: number;
  quantiteTotale: number;
  capaciteTotale: number;
  tauxOccupation: number;
}

export function statsRayonnage(s: Snapshot, idx: Index, rayonnageId: string): StatsRayonnage {
  const emps = s.emplacements.filter((e) => e.Rayonnage === rayonnageId);
  const refs = new Set<string>();
  let q = 0;
  let cap = 0;
  let occ = 0;
  for (const e of emps) {
    cap += e.Capacite;
    const st = idx.stocksParEmplacement.get(e.EmplacementID) ?? [];
    if (st.length) occ++;
    for (const x of st) {
      refs.add(x.ArticleID);
      q += x.Quantite;
    }
  }
  return {
    rayonnageId,
    zone: emps[0]?.Zone ?? '',
    nbEmplacements: emps.length,
    nbEmplacementsOccupes: occ,
    nbReferences: refs.size,
    quantiteTotale: q,
    capaciteTotale: cap,
    tauxOccupation: cap > 0 ? q / cap : 0,
  };
}

export interface Kpis {
  nbReferences: number;
  quantiteDisponible: number;
  quantiteStandby: number;
  quantiteTotale: number;
  ruptures: number;
  sousSeuil: number;
  standbysOuverts: number;
}

export function kpis(s: Snapshot, idx: Index): Kpis {
  let ruptures = 0;
  let sousSeuil = 0;
  let dispo = 0;
  let sb = 0;
  for (const a of s.articles) {
    if (a.Statut !== 'actif') continue;
    const e = etatArticle(idx, a);
    if (e === 'rupture') ruptures++;
    else if (e === 'sous-seuil') sousSeuil++;
  }
  for (const v of idx.disponibleParArticle.values()) dispo += v;
  for (const v of idx.standbyParArticle.values()) sb += v;
  return {
    nbReferences: s.articles.length,
    quantiteDisponible: dispo,
    quantiteStandby: sb,
    quantiteTotale: dispo + sb,
    ruptures,
    sousSeuil,
    standbysOuverts: s.standbys.filter((x) => x.Statut === 'ouvert').length,
  };
}

export function derniersMouvements(s: Snapshot, n: number): Mouvement[] {
  return s.mouvements
    .slice()
    .sort((a, b) => (a.DateHeure < b.DateHeure ? 1 : a.DateHeure > b.DateHeure ? -1 : 0))
    .slice(0, n);
}

// ---------- Recherche globale ----------

export interface ResultatRecherche {
  type: 'article' | 'emplacement';
  id: string;
  libelle: string;
  detail: string;
  /** Emplacements où se trouve la référence (ou l'emplacement lui-même). */
  emplacements: { id: string; quantite: number }[];
  score: number;
}

function normaliser(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function rechercher(s: Snapshot, idx: Index, requete: string, max = 30): ResultatRecherche[] {
  const q = normaliser(requete.trim());
  if (q.length < 1) return [];
  const termes = q.split(/\s+/);
  const out: ResultatRecherche[] = [];
  for (const a of s.articles) {
    const champs = [a.Reference, a.Designation, a.Categorie, a.Constructeur].map(normaliser);
    const stocks = idx.stocksParArticle.get(a.ArticleID) ?? [];
    const emps = stocks.map((x) => normaliser(x.EmplacementID));
    const tout = champs.join(' ') + ' ' + emps.join(' ');
    if (!termes.every((t) => tout.includes(t))) continue;
    let score = 1;
    if (champs[0] === q) score = 100;
    else if (champs[0].startsWith(q)) score = 50;
    else if (champs[0].includes(q)) score = 20;
    out.push({
      type: 'article',
      id: a.ArticleID,
      libelle: a.Reference,
      detail: `${a.Designation} · ${a.Constructeur} · ${a.Categorie}`,
      emplacements: stocks
        .map((x) => ({ id: x.EmplacementID, quantite: x.Quantite }))
        .sort((x, y) => x.id.localeCompare(y.id)),
      score,
    });
  }
  if (q.length >= 2) {
    for (const e of s.emplacements) {
      const id = normaliser(e.EmplacementID);
      if (!termes.every((t) => id.includes(t))) continue;
      out.push({
        type: 'emplacement',
        id: e.EmplacementID,
        libelle: e.EmplacementID,
        detail: `Emplacement · ${(idx.stocksParEmplacement.get(e.EmplacementID) ?? []).length} référence(s)`,
        emplacements: [{ id: e.EmplacementID, quantite: idx.quantiteParEmplacement.get(e.EmplacementID) ?? 0 }],
        score: id === q ? 90 : id.startsWith(q) ? 40 : 10,
      });
    }
  }
  return out.sort((x, y) => y.score - x.score || x.libelle.localeCompare(y.libelle)).slice(0, max);
}
