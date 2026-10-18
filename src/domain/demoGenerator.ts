// Générateur déterministe du jeu de démonstration (seed fixe).
// Les stocks sont construits en rejouant des mouvements via le moteur : le jeu est donc
// cohérent par construction (historique ⇔ quantités).

import { applyMouvement, emptySnapshot, quantiteA } from './engine';
import { emplacementsDepuisLayout, type Layout } from './layout';
import type { Article, MouvementInput, Snapshot } from './types';
import { formatUuid } from './uuid';

/** PRNG mulberry32. */
export function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(l: readonly T[]): T => l[Math.floor(next() * l.length)],
    uuid: () => {
      const b = new Uint8Array(16);
      for (let i = 0; i < 16; i++) b[i] = Math.floor(next() * 256);
      return formatUuid(b);
    },
  };
}

interface Famille {
  categorie: string;
  prefixe: string;
  zone: string;
  unite: string;
  designations: string[];
  constructeurs: string[];
  qte: [number, number];
  mini: [number, number];
}

// Constructeurs et références fictifs.
const FAMILLES: Famille[] = [
  { categorie: 'Relais', prefixe: 'RL', zone: 'A', unite: 'pce', qte: [4, 30], mini: [4, 10],
    designations: ['Relais auxiliaire 24 Vcc 4RT', 'Relais temporisé 0,1 s–10 min', 'Relais de surveillance tension', 'Relais bistable 110 Vcc', 'Relais statique 25 A'],
    constructeurs: ['Voltaris', 'Relexa', 'Norcom'] },
  { categorie: 'Contacteurs', prefixe: 'CT', zone: 'A', unite: 'pce', qte: [2, 18], mini: [2, 6],
    designations: ['Contacteur tripolaire 18 A', 'Contacteur 40 A bobine 230 Va', 'Contacteur auxiliaire 2F+2O', 'Contacteur inverseur 25 A'],
    constructeurs: ['Voltaris', 'Elektrom', 'Norcom'] },
  { categorie: 'Disjoncteurs BT', prefixe: 'DJ', zone: 'B', unite: 'pce', qte: [2, 20], mini: [3, 8],
    designations: ['Disjoncteur 2P C10', 'Disjoncteur 4P C32', 'Disjoncteur moteur 6–10 A', 'Disjoncteur différentiel 30 mA 2P 25 A', 'Disjoncteur boîtier moulé 160 A'],
    constructeurs: ['Protecta', 'Elektrom', 'Disjo'] },
  { categorie: 'Fusibles', prefixe: 'FU', zone: 'B', unite: 'pce', qte: [10, 90], mini: [10, 30],
    designations: ['Fusible gG 10×38 16 A', 'Fusible aM 14×51 25 A', 'Fusible NH00 100 A', 'Fusible ultra-rapide 32 A', 'Cartouche fusible 5×20 2 A'],
    constructeurs: ['Fusix', 'Protecta'] },
  { categorie: 'Cartes électroniques', prefixe: 'CE', zone: 'C', unite: 'pce', qte: [1, 8], mini: [1, 3],
    designations: ["Carte d'entrées TOR 16 voies", 'Carte de sorties relais 8 voies', 'Carte CPU de rechange', 'Carte acquisition analogique 8 voies', "Carte d'interface fibre"],
    constructeurs: ['Calcitec', 'Datamesure', 'Norcom'] },
  { categorie: 'Alimentations', prefixe: 'AL', zone: 'C', unite: 'pce', qte: [1, 10], mini: [1, 4],
    designations: ['Alimentation 24 Vcc 5 A rail DIN', 'Alimentation 48 Vcc 10 A', 'Convertisseur 110/24 Vcc', 'Alimentation redondante 24 Vcc 20 A'],
    constructeurs: ['Voltaris', 'Alimtec'] },
  { categorie: 'Calculateurs', prefixe: 'CA', zone: 'C', unite: 'pce', qte: [1, 4], mini: [1, 2],
    designations: ['Calculateur de protection numérique', 'Calculateur de tranche', 'Unité de contrôle-commande baie', 'Calculateur de comptage'],
    constructeurs: ['Calcitec', 'Datamesure'] },
  { categorie: 'Borniers', prefixe: 'BO', zone: 'D', unite: 'pce', qte: [20, 95], mini: [20, 40],
    designations: ['Borne à vis 4 mm²', 'Borne sectionnable 6 mm²', 'Borne de terre 10 mm²', 'Borne double étage 2,5 mm²', 'Bornier de test 6 pôles'],
    constructeurs: ['Connecta', 'Borneo'] },
  { categorie: 'Connecteurs', prefixe: 'CN', zone: 'D', unite: 'pce', qte: [5, 60], mini: [5, 20],
    designations: ['Connecteur industriel 16 broches', 'Embase M12 5 broches', 'Connecteur RJ45 blindé', 'Fiche 3P+T 32 A', 'Connecteur Sub-D 25 points'],
    constructeurs: ['Connecta', 'Pinsys'] },
  { categorie: 'Capteurs', prefixe: 'CP', zone: 'E', unite: 'pce', qte: [1, 15], mini: [2, 5],
    designations: ['Capteur de température PT100', 'Détecteur inductif M18', 'Transmetteur de pression 0–10 bar', 'Capteur de courant 0–200 A', 'Fin de course à galet'],
    constructeurs: ['Sensora', 'Datamesure'] },
  { categorie: 'Modules de communication', prefixe: 'MC', zone: 'E', unite: 'pce', qte: [1, 8], mini: [1, 3],
    designations: ['Module Modbus TCP', 'Passerelle IEC 61850', 'Switch industriel 8 ports', 'Module Profinet', 'Convertisseur série/fibre'],
    constructeurs: ['Norcom', 'Netindus'] },
  { categorie: 'Automates', prefixe: 'AU', zone: 'E', unite: 'pce', qte: [1, 5], mini: [1, 2],
    designations: ['Automate compact 24 E/S', 'Châssis automate 8 emplacements', 'Module CPU automate', 'Coupleur E/S déportées'],
    constructeurs: ['Automa', 'Calcitec'] },
  { categorie: 'Câbles', prefixe: 'CB', zone: 'F', unite: 'm', qte: [5, 28], mini: [5, 15],
    designations: ['Câble U1000 R2V 3G2,5', 'Câble blindé 4 paires', 'Câble fibre optique 12 brins', 'Câble souple H07RN-F 4G6', 'Câble de commande 12×1,5'],
    constructeurs: ['Cablor', 'Filinter'] },
  { categorie: 'Accessoires', prefixe: 'AC', zone: 'D', unite: 'pce', qte: [10, 80], mini: [10, 25],
    designations: ['Repères de câble (sachet)', 'Embouts de câblage 1,5 mm²', 'Goulotte 60×60 (barre)', 'Rail DIN 35 mm (barre)', 'Presse-étoupe M20'],
    constructeurs: ['Borneo', 'Fixa'] },
  { categorie: 'Outillage', prefixe: 'OU', zone: 'F', unite: 'pce', qte: [1, 6], mini: [1, 2],
    designations: ['Pince à sertir embouts', 'Valise de test relais', 'Multimètre industriel', 'Dénudeur automatique', 'Caméra thermique portable'],
    constructeurs: ['Outilex', 'Fixa'] },
];

export const DEMO_SEED = 20261018;
export const DEMO_NB_ARTICLES = 120;
const DATE_DEBUT = Date.UTC(2026, 3, 1, 6, 0, 0); // 1er avril 2026
const DATE_FIN = Date.UTC(2026, 9, 15, 17, 0, 0); // 15 octobre 2026
const UTILISATEURS = ['j.martin', 'a.durand', 's.bernard', 'm.petit'];
const CHANTIERS = ['Poste source Valmont', 'Centrale Les Arcs — tranche 2', 'Sous-station Nord', 'Atelier maintenance Ouest'];

export function genererDemo(layout: Layout, seed = DEMO_SEED): Snapshot {
  const r = prng(seed);
  const emplacements = emplacementsDepuisLayout(layout);
  const articles: Article[] = [];
  for (let i = 0; i < DEMO_NB_ARTICLES; i++) {
    const f = FAMILLES[i % FAMILLES.length];
    const d = f.designations[Math.floor(i / FAMILLES.length) % f.designations.length];
    const mini = r.int(f.mini[0], f.mini[1]);
    articles.push({
      ArticleID: `ART-${String(i + 1).padStart(4, '0')}`,
      Reference: `${f.prefixe}-${String(r.int(1000, 9999))}${String.fromCharCode(65 + (i % 26))}`,
      Designation: d,
      Categorie: f.categorie,
      Constructeur: r.pick(f.constructeurs),
      Description: `${d} — article fictif de démonstration.`,
      StockMinimum: mini,
      ...(r.next() < 0.6 ? { StockMaximum: mini * r.int(4, 8) } : {}),
      Unite: f.unite,
      Statut: 'actif',
    });
  }

  let s: Snapshot = { ...emptySnapshot(), articles, emplacements };

  // Emplacements libres par zone, consommés dans un ordre pseudo-aléatoire.
  const libres = new Map<string, string[]>();
  for (const e of emplacements) {
    const l = libres.get(e.Zone) ?? [];
    l.push(e.EmplacementID);
    libres.set(e.Zone, l);
  }
  for (const l of libres.values()) {
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [l[i], l[j]] = [l[j], l[i]];
    }
  }
  const prendre = (zone: string): string => {
    const l = libres.get(zone)!;
    if (l.length) return l.pop()!;
    return r.pick(emplacements.filter((e) => e.Zone === zone)).EmplacementID;
  };

  const n = articles.length;
  let t = DATE_DEBUT;
  const pas = (DATE_FIN - DATE_DEBUT) / (n * 1.65);
  const date = () => {
    t += pas * (0.4 + r.next() * 1.2);
    // Ramène l'instant dans la plage 6 h–16 h UTC (heures ouvrées) en conservant l'ordre chronologique.
    const jourMs = 86_400_000;
    const debutJour = Math.floor(t / jourMs) * jourMs;
    const h = debutJour + 6 * 3_600_000 + ((t - debutJour) / jourMs) * 10 * 3_600_000;
    return new Date(Math.round(h / 60000) * 60000).toISOString();
  };
  const appliquer = (m: Omit<MouvementInput, 'MouvementID' | 'DateHeure' | 'Utilisateur'>) => {
    const res = applyMouvement(s, { ...m, MouvementID: r.uuid(), DateHeure: date(), Utilisateur: r.pick(UTILISATEURS) });
    if (!res.ok) throw new Error(`Générateur démo : ${res.error}`);
    s = res.snapshot;
  };

  // Profils : ~6 ruptures, ~10 sous-seuil, ~25 multi-emplacements, le reste normal.
  const profil = (i: number) => (i % 20 === 7 ? 'rupture' : i % 12 === 5 ? 'sous-seuil' : i % 5 === 1 ? 'multi' : 'normal');

  const placements = new Map<string, string[]>();
  for (let i = 0; i < n; i++) {
    const a = articles[i];
    const f = FAMILLES[i % FAMILLES.length];
    const p = profil(i);
    const e1 = prendre(f.zone);
    placements.set(a.ArticleID, [e1]);
    let q = r.int(f.qte[0], f.qte[1]);
    if (p === 'sous-seuil') q = Math.max(1, a.StockMinimum - r.int(1, Math.max(1, a.StockMinimum - 1)));
    else q = Math.max(q, a.StockMinimum + 1);
    appliquer({ Type: 'ENTREE', ArticleID: a.ArticleID, EmplacementDestination: e1, Quantite: q, Motif: 'Inventaire initial', Commentaire: '' });
    if (p === 'multi') {
      const e2 = prendre(f.zone);
      placements.get(a.ArticleID)!.push(e2);
      appliquer({ Type: 'ENTREE', ArticleID: a.ArticleID, EmplacementDestination: e2, Quantite: r.int(f.qte[0], f.qte[1]), Motif: 'Réception commande', Commentaire: '' });
    }
  }

  // Activité : sorties, transferts, ruptures, stand-by.
  for (let i = 0; i < n; i++) {
    const a = articles[i];
    const p = profil(i);
    const [e1] = placements.get(a.ArticleID)!;
    const dispo = quantiteA(s, a.ArticleID, e1);
    if (p === 'rupture') {
      appliquer({ Type: 'SORTIE', ArticleID: a.ArticleID, EmplacementSource: e1, Quantite: dispo, Motif: 'Dépannage', Destination: r.pick(CHANTIERS), Commentaire: 'Dernières pièces' });
    } else if (p === 'normal' && dispo > a.StockMinimum + 2 && r.next() < 0.5) {
      const q = r.int(1, Math.max(1, Math.floor((dispo - a.StockMinimum) / 2)));
      appliquer({ Type: 'SORTIE', ArticleID: a.ArticleID, EmplacementSource: e1, Quantite: q, Motif: r.pick(['Maintenance préventive', 'Dépannage', 'Travaux neufs']), Destination: r.pick(CHANTIERS), Commentaire: '' });
    }
  }
  // Quelques transferts entre emplacements d'une même zone.
  for (let i = 3; i < n; i += 17) {
    const a = articles[i];
    if (profil(i) === 'rupture') continue;
    const [e1] = placements.get(a.ArticleID)!;
    const dispo = quantiteA(s, a.ArticleID, e1);
    if (dispo < 2) continue;
    const e2 = prendre(FAMILLES[i % FAMILLES.length].zone);
    appliquer({ Type: 'TRANSFERT', ArticleID: a.ArticleID, EmplacementSource: e1, EmplacementDestination: e2, Quantite: Math.floor(dispo / 2), Motif: 'Réorganisation', Commentaire: '' });
  }
  // Stand-by : départs, puis un retour et un consommé ; 4 restent ouverts.
  const sbArticles = [2, 9, 16, 30, 44, 58].map((i) => articles[i]).filter((_a, k) => profil([2, 9, 16, 30, 44, 58][k]) !== 'rupture');
  const sbIds: string[] = [];
  for (const a of sbArticles) {
    const [e1] = placements.get(a.ArticleID)!;
    const dispo = quantiteA(s, a.ArticleID, e1);
    if (dispo < 2) continue;
    const id = `SB-${r.uuid()}`;
    appliquer({ Type: 'STANDBY_DEPART', ArticleID: a.ArticleID, EmplacementSource: e1, Quantite: Math.min(3, dispo - 1), Chantier: r.pick(CHANTIERS), StandbyID: id, Motif: 'Au cas où', Commentaire: '' });
    sbIds.push(id);
  }
  if (sbIds.length >= 2) {
    const sb0 = s.standbys.find((x) => x.StandbyID === sbIds[0])!;
    appliquer({ Type: 'STANDBY_RETOUR', ArticleID: sb0.ArticleID, StandbyID: sb0.StandbyID, Quantite: sb0.Quantite, EmplacementDestination: sb0.EmplacementOrigine, Motif: 'Non utilisé', Commentaire: '' });
    const sb1 = s.standbys.find((x) => x.StandbyID === sbIds[1])!;
    appliquer({ Type: 'STANDBY_CONSOMME', ArticleID: sb1.ArticleID, StandbyID: sb1.StandbyID, Quantite: sb1.Quantite, Motif: 'Utilisé sur chantier', Commentaire: '' });
  }
  return s;
}
