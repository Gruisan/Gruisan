// Import / export Excel (SheetJS). Une feuille par table ; les en-têtes de colonnes sont
// configurables (config/import-mapping.json) pour s'aligner sur les listes SharePoint / Power Apps.
//
// Import = remplacement complet des données. Rien n'est écrit tant que l'analyse n'est pas
// terminée ; s'il reste une erreur bloquante, aucun Snapshot n'est produit.

import * as XLSX from 'xlsx';
import { emptySnapshot, stockId } from './engine';
import type { Article, Emplacement, Mouvement, Snapshot, Standby, Stock } from './types';
import { TYPES_MOUVEMENT } from './types';

export type NomTable = 'articles' | 'emplacements' | 'stocks' | 'mouvements' | 'standbys';
export const TABLES: NomTable[] = ['articles', 'emplacements', 'stocks', 'mouvements', 'standbys'];

export interface MappingTable {
  feuille: string;
  /** champ interne -> en-tête de colonne Excel */
  colonnes: Record<string, string>;
}

export interface MappingImport {
  version: 1;
  description?: string;
  tables: Record<NomTable, MappingTable>;
  options?: {
    /** true : la moindre ligne rejetée bloque tout l'import. */
    rejetsBloquants?: boolean;
  };
}

// ---------- Description des champs ----------

type TypeChamp = 'texte' | 'entier' | 'date' | 'enum';

interface Champ {
  type: TypeChamp;
  /** Valeur obligatoire (et colonne obligatoire dans la feuille). */
  requis?: boolean;
  /** Valeur par défaut si la cellule est vide (champ non requis). */
  defaut?: unknown;
  /** Cellule vide -> null (au lieu d'absent). */
  nullable?: boolean;
  min?: number;
  valeurs?: readonly string[];
}

const T = (o: Partial<Champ> = {}): Champ => ({ type: 'texte', ...o });
const N = (o: Partial<Champ> = {}): Champ => ({ type: 'entier', ...o });
const D = (o: Partial<Champ> = {}): Champ => ({ type: 'date', ...o });

export const SCHEMA: Record<NomTable, Record<string, Champ>> = {
  articles: {
    ArticleID: T({ requis: true }),
    Reference: T({ requis: true }),
    Designation: T({ requis: true }),
    Categorie: T({ defaut: '' }),
    Constructeur: T({ defaut: '' }),
    Description: T({ defaut: '' }),
    StockMinimum: N({ min: 0, defaut: 0 }),
    StockMaximum: N({ min: 0 }),
    Unite: T({ defaut: 'pce' }),
    Statut: { type: 'enum', valeurs: ['actif', 'obsolete'], defaut: 'actif' },
  },
  emplacements: {
    EmplacementID: T({ requis: true }),
    Zone: T({ requis: true }),
    Rayonnage: T({ requis: true }),
    Niveau: T({ requis: true }),
    Position: T({ requis: true }),
    Capacite: N({ requis: true, min: 0 }),
  },
  stocks: {
    StockID: T(),
    ArticleID: T({ requis: true }),
    EmplacementID: T({ requis: true }),
    Quantite: N({ requis: true, min: 0 }),
    Version: N({ min: 1, defaut: 1 }),
    DateModification: D(),
  },
  mouvements: {
    MouvementID: T({ requis: true }),
    DateHeure: D({ requis: true }),
    Type: { type: 'enum', requis: true, valeurs: TYPES_MOUVEMENT },
    ArticleID: T({ requis: true }),
    EmplacementSource: T({ nullable: true }),
    EmplacementDestination: T({ nullable: true }),
    Quantite: N({ requis: true, min: 0 }),
    Utilisateur: T({ requis: true }),
    Motif: T({ defaut: '' }),
    Destination: T({ defaut: '' }),
    Commentaire: T({ defaut: '' }),
    StandbyID: T(),
    Ecart: N(),
  },
  standbys: {
    StandbyID: T({ requis: true }),
    ArticleID: T({ requis: true }),
    EmplacementOrigine: T({ requis: true }),
    Quantite: N({ requis: true, min: 1 }),
    Chantier: T({ requis: true }),
    Utilisateur: T({ requis: true }),
    DateSortie: D({ requis: true }),
    DateRetour: D({ nullable: true }),
    Statut: { type: 'enum', requis: true, valeurs: ['ouvert', 'clos'] },
    QuantiteRetournee: N({ min: 0, defaut: 0 }),
    QuantiteConsommee: N({ min: 0, defaut: 0 }),
  },
};

/** Feuilles sans lesquelles l'import n'a pas de sens. */
const FEUILLES_OBLIGATOIRES: NomTable[] = ['articles', 'emplacements', 'stocks'];

export const LIBELLE_TABLE: Record<NomTable, string> = {
  articles: 'Articles',
  emplacements: 'Emplacements',
  stocks: 'Stocks',
  mouvements: 'Mouvements',
  standbys: 'Stand-by',
};

// ---------- Mapping ----------

/** Vérifie un mapping (JSON saisi par l'utilisateur ou fichier de config). Lève une erreur explicite. */
export function validerMapping(x: unknown): MappingImport {
  const m = x as MappingImport;
  if (!m || typeof m !== 'object' || !m.tables) throw new Error('Mapping invalide : objet « tables » absent.');
  for (const t of TABLES) {
    const mt = m.tables[t];
    if (!mt || typeof mt.feuille !== 'string' || !mt.feuille.trim()) throw new Error(`Mapping invalide : nom de feuille manquant pour « ${t} ».`);
    if (!mt.colonnes || typeof mt.colonnes !== 'object') throw new Error(`Mapping invalide : « colonnes » manquant pour « ${t} ».`);
    for (const [champ, def] of Object.entries(SCHEMA[t])) {
      const col = mt.colonnes[champ];
      if (col !== undefined && (typeof col !== 'string' || !col.trim())) throw new Error(`Mapping invalide : en-tête vide pour ${t}.${champ}.`);
      if (def.requis && col === undefined) throw new Error(`Mapping invalide : le champ obligatoire ${t}.${champ} n'est associé à aucune colonne.`);
    }
    for (const champ of Object.keys(mt.colonnes)) {
      if (!(champ in SCHEMA[t])) throw new Error(`Mapping invalide : champ inconnu ${t}.${champ}.`);
    }
    const entetes = Object.values(mt.colonnes).map(normaliser);
    if (new Set(entetes).size !== entetes.length) throw new Error(`Mapping invalide : deux champs de « ${t} » pointent vers la même colonne.`);
  }
  const feuilles = TABLES.map((t) => normaliser(m.tables[t].feuille));
  if (new Set(feuilles).size !== feuilles.length) throw new Error('Mapping invalide : deux tables pointent vers la même feuille.');
  return m;
}

function normaliser(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// ---------- Export ----------

function versCellule(v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

/** Construit le classeur (une feuille par table + une feuille INFOS ignorée à l'import). */
export function exporterClasseur(s: Snapshot, mapping: MappingImport, dateExport = new Date()): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const lignes: Record<NomTable, object[]> = {
    articles: s.articles,
    emplacements: s.emplacements,
    stocks: s.stocks,
    mouvements: s.mouvements,
    standbys: s.standbys,
  };
  for (const t of TABLES) {
    const { feuille, colonnes } = mapping.tables[t];
    const champs = Object.keys(SCHEMA[t]).filter((c) => colonnes[c] !== undefined);
    const aoa: (string | number | null)[][] = [champs.map((c) => colonnes[c])];
    for (const o of lignes[t]) aoa.push(champs.map((c) => versCellule((o as Record<string, unknown>)[c])));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = champs.map((c) => ({ wch: Math.min(40, Math.max(colonnes[c].length + 2, ...aoa.slice(1, 200).map((l) => String(l[champs.indexOf(c)] ?? '').length + 1))) }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: champs.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, feuille);
  }
  const infos = XLSX.utils.aoa_to_sheet([
    ['Magasin 3D — Digital Stock'],
    ['Format', 'magasin3d-inventaire', 'schéma 1'],
    ['Exporté le', dateExport.toISOString()],
    ...TABLES.map((t) => [LIBELLE_TABLE[t], mapping.tables[t].feuille, lignes[t].length]),
    [],
    ['Les dates sont au format ISO 8601 (UTC). Cette feuille est ignorée à l’import.'],
  ]);
  infos['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, infos, 'INFOS');
  return wb;
}

export function classeurVersOctets(wb: XLSX.WorkBook): Uint8Array<ArrayBuffer> {
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer);
}

export function lireClasseur(octets: ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(octets, { type: 'array', cellDates: true, dense: false });
}

// ---------- Import ----------

export interface Probleme {
  feuille: string;
  /** Numéro de ligne Excel (1 = en-têtes). */
  ligne?: number;
  colonne?: string;
  valeur?: string;
  raison: string;
}

export interface RapportImport {
  /** true : aucune donnée ne doit être écrite. */
  bloquant: boolean;
  erreursBloquantes: Probleme[];
  rejets: Probleme[];
  avertissements: string[];
  compte: Record<NomTable, { lues: number; acceptees: number; rejetees: number }>;
  /** Présent uniquement si l'import n'est pas bloqué. */
  snapshot?: Snapshot;
}

class RejetLigne extends Error {
  constructor(
    message: string,
    readonly colonne?: string,
    readonly valeur?: string,
  ) {
    super(message);
  }
}

function texteCellule(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function estVide(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Convertit une cellule selon le type du champ ; lève RejetLigne si la valeur est invalide. */
function convertir(def: Champ, v: unknown, entete: string): unknown {
  if (estVide(v)) {
    if (def.requis) throw new RejetLigne(`Valeur obligatoire manquante (${entete}).`, entete);
    if (def.nullable) return null;
    return def.defaut;
  }
  const brut = texteCellule(v);
  switch (def.type) {
    case 'texte':
      return brut;
    case 'entier': {
      const n = typeof v === 'number' ? v : Number(brut.replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(n) || !Number.isInteger(n)) throw new RejetLigne(`${entete} doit être un nombre entier.`, entete, brut);
      if (def.min !== undefined && n < def.min) throw new RejetLigne(`${entete} doit être ≥ ${def.min}.`, entete, brut);
      return n;
    }
    case 'date': {
      let d: Date;
      if (v instanceof Date) d = v;
      else if (typeof v === 'number') d = new Date(Math.round((v - 25569) * 86_400_000)); // numéro de série Excel
      else d = new Date(brut);
      if (Number.isNaN(d.getTime())) throw new RejetLigne(`${entete} : date illisible.`, entete, brut);
      return d.toISOString();
    }
    case 'enum': {
      const n = normaliser(brut).replace(/[\s-]+/g, '_');
      const ok = def.valeurs!.find((x) => normaliser(x) === n);
      if (!ok) throw new RejetLigne(`${entete} : valeur « ${brut} » non reconnue (attendu : ${def.valeurs!.join(', ')}).`, entete, brut);
      return ok;
    }
  }
}

interface LigneLue {
  ligne: number;
  valeurs: Record<string, unknown>;
}

/** Lit une feuille et convertit chaque ligne ; les lignes invalides vont dans `rejets`. */
function lireTable(
  wb: XLSX.WorkBook,
  t: NomTable,
  mapping: MappingImport,
  rapport: RapportImport,
): LigneLue[] | null {
  const { feuille, colonnes } = mapping.tables[t];
  const nomReel = wb.SheetNames.find((n) => normaliser(n) === normaliser(feuille));
  if (!nomReel) {
    if (FEUILLES_OBLIGATOIRES.includes(t)) rapport.erreursBloquantes.push({ feuille, raison: `Feuille « ${feuille} » absente du classeur.` });
    else rapport.avertissements.push(`Feuille « ${feuille} » absente : ${LIBELLE_TABLE[t].toLowerCase()} importés vides.`);
    return FEUILLES_OBLIGATOIRES.includes(t) ? null : [];
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomReel], { header: 1, raw: true, defval: null, blankrows: true });
  const entetes = (rows[0] ?? []).map((h) => (h == null ? '' : normaliser(String(h))));
  const indexChamp: Record<string, number> = {};
  let manque = false;
  for (const [champ, def] of Object.entries(SCHEMA[t])) {
    const col = colonnes[champ];
    if (col === undefined) continue;
    const i = entetes.indexOf(normaliser(col));
    if (i >= 0) indexChamp[champ] = i;
    else if (def.requis) {
      rapport.erreursBloquantes.push({ feuille: nomReel, ligne: 1, colonne: col, raison: `Colonne obligatoire « ${col} » absente.` });
      manque = true;
    }
  }
  if (manque) return null;
  const out: LigneLue[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.every(estVide)) continue;
    rapport.compte[t].lues++;
    try {
      const valeurs: Record<string, unknown> = {};
      for (const [champ, def] of Object.entries(SCHEMA[t])) {
        const i = indexChamp[champ];
        const v = convertir(def, i === undefined ? null : row[i], colonnes[champ] ?? champ);
        if (v !== undefined) valeurs[champ] = v;
      }
      out.push({ ligne: r + 1, valeurs });
    } catch (e) {
      if (!(e instanceof RejetLigne)) throw e;
      rejeter(rapport, t, nomReel, r + 1, e.message, e.colonne, e.valeur);
    }
  }
  return out;
}

function rejeter(rapport: RapportImport, t: NomTable, feuille: string, ligne: number, raison: string, colonne?: string, valeur?: string) {
  rapport.rejets.push({ feuille, ligne, colonne, valeur, raison });
  rapport.compte[t].rejetees++;
}

export interface OptionsImport {
  /** Emplacements définis par la géométrie (layout) : sert aux avertissements. */
  emplacementsLayout?: string[];
}

/** Analyse complète du classeur. Ne modifie rien : le Snapshot retourné est à appliquer par l'appelant. */
export function importerClasseur(wb: XLSX.WorkBook, mapping: MappingImport, opts: OptionsImport = {}): RapportImport {
  const rapport: RapportImport = {
    bloquant: false,
    erreursBloquantes: [],
    rejets: [],
    avertissements: [],
    compte: Object.fromEntries(TABLES.map((t) => [t, { lues: 0, acceptees: 0, rejetees: 0 }])) as RapportImport['compte'],
  };
  const lu = Object.fromEntries(TABLES.map((t) => [t, lireTable(wb, t, mapping, rapport)])) as Record<NomTable, LigneLue[] | null>;
  if (TABLES.some((t) => lu[t] === null)) return terminer(rapport, mapping);
  const feuille = (t: NomTable) => mapping.tables[t].feuille;
  const col = (t: NomTable, c: string) => mapping.tables[t].colonnes[c] ?? c;

  // Articles : clé primaire unique (doublon = bloquant, l'import serait ambigu).
  const articles: Article[] = [];
  const parId = new Map<string, Article>();
  const parRef = new Map<string, Article>();
  for (const { ligne, valeurs } of lu.articles!) {
    const a = valeurs as unknown as Article;
    if (parId.has(a.ArticleID)) {
      rapport.erreursBloquantes.push({ feuille: feuille('articles'), ligne, colonne: col('articles', 'ArticleID'), valeur: a.ArticleID, raison: `ArticleID en double : ${a.ArticleID}.` });
      continue;
    }
    if (parRef.has(normaliser(a.Reference))) {
      rejeter(rapport, 'articles', feuille('articles'), ligne, `Référence en double : ${a.Reference} (déjà portée par ${parRef.get(normaliser(a.Reference))!.ArticleID}).`, col('articles', 'Reference'), a.Reference);
      continue;
    }
    if (a.StockMaximum !== undefined && a.StockMaximum < a.StockMinimum) {
      rejeter(rapport, 'articles', feuille('articles'), ligne, `StockMaximum (${a.StockMaximum}) inférieur au StockMinimum (${a.StockMinimum}).`, col('articles', 'StockMaximum'), String(a.StockMaximum));
      continue;
    }
    parId.set(a.ArticleID, a);
    parRef.set(normaliser(a.Reference), a);
    articles.push(a);
  }

  // Emplacements.
  const emplacements: Emplacement[] = [];
  const emps = new Set<string>();
  for (const { ligne, valeurs } of lu.emplacements!) {
    const e = valeurs as unknown as Emplacement;
    if (emps.has(e.EmplacementID)) {
      rapport.erreursBloquantes.push({ feuille: feuille('emplacements'), ligne, colonne: col('emplacements', 'EmplacementID'), valeur: e.EmplacementID, raison: `EmplacementID en double : ${e.EmplacementID}.` });
      continue;
    }
    emps.add(e.EmplacementID);
    emplacements.push(e);
  }

  /** Résout un article par son ID, ou à défaut par sa référence (listes SharePoint). */
  const resoudre = (t: NomTable, ligne: number, v: string): string | null => {
    const a = parId.get(v) ?? parRef.get(normaliser(v));
    if (!a) {
      rejeter(rapport, t, feuille(t), ligne, `Référence inconnue : ${v}.`, col(t, 'ArticleID'), v);
      return null;
    }
    return a.ArticleID;
  };
  const exigerEmp = (t: NomTable, champ: string, ligne: number, v: string | null | undefined): boolean => {
    if (v == null || emps.has(v)) return true;
    rejeter(rapport, t, feuille(t), ligne, `Emplacement inconnu : ${v}.`, col(t, champ), v);
    return false;
  };

  // Stocks.
  const stocks: Stock[] = [];
  const cles = new Set<string>();
  const ids = new Set<string>();
  for (const { ligne, valeurs } of lu.stocks!) {
    const articleId = resoudre('stocks', ligne, valeurs.ArticleID as string);
    if (!articleId) continue;
    const empId = valeurs.EmplacementID as string;
    if (!exigerEmp('stocks', 'EmplacementID', ligne, empId)) continue;
    const cle = `${articleId}|${empId}`;
    if (cles.has(cle)) {
      rejeter(rapport, 'stocks', feuille('stocks'), ligne, `Ligne de stock en double pour ${parId.get(articleId)!.Reference} à ${empId}.`);
      continue;
    }
    const q = valeurs.Quantite as number;
    if (q === 0) {
      rapport.avertissements.push(`${feuille('stocks')} ligne ${ligne} : quantité nulle ignorée (${parId.get(articleId)!.Reference} à ${empId}).`);
      continue;
    }
    const id = (valeurs.StockID as string | undefined) ?? stockId(articleId, empId);
    if (ids.has(id)) {
      rejeter(rapport, 'stocks', feuille('stocks'), ligne, `StockID en double : ${id}.`, col('stocks', 'StockID'), id);
      continue;
    }
    cles.add(cle);
    ids.add(id);
    stocks.push({
      StockID: id,
      ArticleID: articleId,
      EmplacementID: empId,
      Quantite: q,
      Version: (valeurs.Version as number) ?? 1,
      DateModification: (valeurs.DateModification as string | undefined) ?? new Date().toISOString(),
    });
  }

  // Stand-by (avant les mouvements, qui peuvent y faire référence).
  const standbys: Standby[] = [];
  const sbIds = new Set<string>();
  for (const { ligne, valeurs } of lu.standbys!) {
    const articleId = resoudre('standbys', ligne, valeurs.ArticleID as string);
    if (!articleId) continue;
    const sb = { ...(valeurs as unknown as Standby), ArticleID: articleId };
    if (!exigerEmp('standbys', 'EmplacementOrigine', ligne, sb.EmplacementOrigine)) continue;
    if (sbIds.has(sb.StandbyID)) {
      rapport.erreursBloquantes.push({ feuille: feuille('standbys'), ligne, valeur: sb.StandbyID, raison: `StandbyID en double : ${sb.StandbyID}.` });
      continue;
    }
    const reste = sb.Quantite - sb.QuantiteRetournee - sb.QuantiteConsommee;
    if (reste < 0) {
      rejeter(rapport, 'standbys', feuille('standbys'), ligne, `Retourné + consommé (${sb.QuantiteRetournee + sb.QuantiteConsommee}) supérieur à la quantité partie (${sb.Quantite}).`);
      continue;
    }
    if ((sb.Statut === 'clos') !== (reste === 0)) {
      rejeter(rapport, 'standbys', feuille('standbys'), ligne, `Statut « ${sb.Statut} » incohérent : ${reste} unité(s) encore en stand-by.`, col('standbys', 'Statut'), sb.Statut);
      continue;
    }
    sbIds.add(sb.StandbyID);
    standbys.push(sb);
  }

  // Mouvements.
  const mouvements: Mouvement[] = [];
  const mvIds = new Set<string>();
  for (const { ligne, valeurs } of lu.mouvements!) {
    const articleId = resoudre('mouvements', ligne, valeurs.ArticleID as string);
    if (!articleId) continue;
    const m = { ...(valeurs as unknown as Mouvement), ArticleID: articleId };
    if (!exigerEmp('mouvements', 'EmplacementSource', ligne, m.EmplacementSource)) continue;
    if (!exigerEmp('mouvements', 'EmplacementDestination', ligne, m.EmplacementDestination)) continue;
    if (m.Quantite === 0 && m.Type !== 'AJUSTEMENT') {
      rejeter(rapport, 'mouvements', feuille('mouvements'), ligne, 'Quantité nulle interdite pour ce type de mouvement.', col('mouvements', 'Quantite'), '0');
      continue;
    }
    if (mvIds.has(m.MouvementID)) {
      // Même UUID = même mouvement : on n'importe pas de doublon.
      rejeter(rapport, 'mouvements', feuille('mouvements'), ligne, `MouvementID en double : ${m.MouvementID} (ligne ignorée).`, col('mouvements', 'MouvementID'), m.MouvementID);
      continue;
    }
    if (m.StandbyID && !sbIds.has(m.StandbyID)) {
      rapport.avertissements.push(`${feuille('mouvements')} ligne ${ligne} : stand-by ${m.StandbyID} introuvable (mouvement conservé).`);
    }
    mvIds.add(m.MouvementID);
    mouvements.push(m);
  }

  // Cohérence avec la géométrie (non bloquant).
  if (opts.emplacementsLayout) {
    const geo = new Set(opts.emplacementsLayout);
    const horsGeo = emplacements.filter((e) => !geo.has(e.EmplacementID)).map((e) => e.EmplacementID);
    if (horsGeo.length) rapport.avertissements.push(`${horsGeo.length} emplacement(s) absent(s) de la géométrie (layout.json), donc non affiché(s) en 3D : ${horsGeo.slice(0, 8).join(', ')}${horsGeo.length > 8 ? '…' : ''}`);
    const sansLigne = opts.emplacementsLayout.filter((id) => !emps.has(id));
    if (sansLigne.length) rapport.avertissements.push(`${sansLigne.length} emplacement(s) du layout absent(s) du classeur : ils ne pourront pas recevoir de stock.`);
  }

  for (const [t, n] of [
    ['articles', articles.length],
    ['emplacements', emplacements.length],
    ['stocks', stocks.length],
    ['mouvements', mouvements.length],
    ['standbys', standbys.length],
  ] as const)
    rapport.compte[t].acceptees = n;

  rapport.snapshot = { ...emptySnapshot(), articles, emplacements, stocks, mouvements, standbys };
  return terminer(rapport, mapping);
}

function terminer(rapport: RapportImport, mapping: MappingImport): RapportImport {
  rapport.bloquant = rapport.erreursBloquantes.length > 0 || (!!mapping.options?.rejetsBloquants && rapport.rejets.length > 0);
  if (rapport.bloquant) delete rapport.snapshot;
  return rapport;
}
