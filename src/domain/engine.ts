// Moteur de stock : fonctions pures, sans effet de bord.
// Chaque mouvement produit un nouveau Snapshot complet ou une erreur : jamais d'état partiel
// (le transfert est donc atomique par construction).

import type { ApplyResult, Mouvement, MouvementInput, Snapshot, Standby, Stock } from './types';
import { uuidv4 } from './uuid';

export function stockId(articleId: string, emplacementId: string): string {
  return `S-${articleId}-${emplacementId}`;
}

export function emptySnapshot(): Snapshot {
  return { schemaVersion: 1, articles: [], emplacements: [], stocks: [], mouvements: [], standbys: [] };
}

/** Quantité d'une référence à un emplacement. */
export function quantiteA(s: Snapshot, articleId: string, emplacementId: string): number {
  return s.stocks.find((x) => x.ArticleID === articleId && x.EmplacementID === emplacementId)?.Quantite ?? 0;
}

/** Stock disponible = somme des emplacements. */
export function stockDisponible(s: Snapshot, articleId: string): number {
  let t = 0;
  for (const x of s.stocks) if (x.ArticleID === articleId) t += x.Quantite;
  return t;
}

export function quantiteStandbyRestante(sb: Standby): number {
  return sb.Quantite - sb.QuantiteRetournee - sb.QuantiteConsommee;
}

/** Quantité en stand-by ouvert (partie en chantier, non revenue, non consommée). */
export function stockStandby(s: Snapshot, articleId: string): number {
  let t = 0;
  for (const sb of s.standbys) if (sb.ArticleID === articleId && sb.Statut === 'ouvert') t += quantiteStandbyRestante(sb);
  return t;
}

/** Stock total = disponible + stand-by ouvert. */
export function stockTotal(s: Snapshot, articleId: string): number {
  return stockDisponible(s, articleId) + stockStandby(s, articleId);
}

class RefusMouvement extends Error {}

function refuse(msg: string): never {
  throw new RefusMouvement(msg);
}

/** Ajoute delta (signé) au stock (article, emplacement) en refusant toute quantité négative. */
function ajusterStock(stocks: Stock[], articleId: string, emplacementId: string, delta: number, date: string): Stock[] {
  const id = stockId(articleId, emplacementId);
  const idx = stocks.findIndex((x) => x.StockID === id);
  const actuel = idx >= 0 ? stocks[idx].Quantite : 0;
  const nouveau = actuel + delta;
  if (nouveau < 0) refuse(`Quantité négative interdite à l'emplacement ${emplacementId} (disponible : ${actuel}).`);
  const out = stocks.slice();
  if (idx >= 0) {
    if (nouveau === 0) out.splice(idx, 1);
    else out[idx] = { ...stocks[idx], Quantite: nouveau, Version: stocks[idx].Version + 1, DateModification: date };
  } else if (nouveau > 0) {
    out.push({ StockID: id, ArticleID: articleId, EmplacementID: emplacementId, Quantite: nouveau, Version: 1, DateModification: date });
  }
  return out;
}

function exigerQuantite(q: number) {
  if (!Number.isFinite(q) || !Number.isInteger(q) || q <= 0) refuse('La quantité doit être un nombre entier strictement positif.');
}

function exigerEmplacement(s: Snapshot, id: string | null | undefined, role: string): string {
  if (!id) refuse(`Emplacement ${role} obligatoire.`);
  if (!s.emplacements.some((e) => e.EmplacementID === id)) refuse(`Emplacement ${role} inconnu : ${id}.`);
  return id;
}

function exigerDisponible(s: Snapshot, articleId: string, emplacementId: string, q: number, ref: string, action: string) {
  const dispo = quantiteA(s, articleId, emplacementId);
  if (q > dispo) {
    refuse(`${action} : ${q} demandé(s) pour ${ref} mais seulement ${dispo} disponible(s) à l'emplacement ${emplacementId}.`);
  }
}

/**
 * Applique un mouvement. Idempotent sur MouvementID : rejouer un UUID déjà historisé
 * ne modifie rien et renvoie duplicate = true.
 */
export function applyMouvement(s: Snapshot, input: MouvementInput): ApplyResult {
  if (input.MouvementID) {
    const existant = s.mouvements.find((m) => m.MouvementID === input.MouvementID);
    if (existant) return { ok: true, snapshot: s, mouvement: existant, duplicate: true };
  }
  try {
    return applyStrict(s, input);
  } catch (e) {
    if (e instanceof RefusMouvement) return { ok: false, error: e.message };
    throw e;
  }
}

function applyStrict(s: Snapshot, input: MouvementInput): ApplyResult {
  const article = s.articles.find((a) => a.ArticleID === input.ArticleID);
  if (!article) refuse(`Référence inconnue : ${input.ArticleID}.`);
  if (!input.Utilisateur?.trim()) refuse('Utilisateur obligatoire.');

  const date = input.DateHeure ?? new Date().toISOString();
  const q = input.Quantite;
  const ref = article.Reference;
  let stocks = s.stocks;
  let standbys = s.standbys;
  let source: string | null = null;
  let dest: string | null = null;
  let standbyId: string | undefined;
  let ecart: number | undefined;

  switch (input.Type) {
    case 'ENTREE': {
      exigerQuantite(q);
      dest = exigerEmplacement(s, input.EmplacementDestination, 'de destination');
      stocks = ajusterStock(stocks, article.ArticleID, dest, q, date);
      break;
    }
    case 'SORTIE': {
      exigerQuantite(q);
      source = exigerEmplacement(s, input.EmplacementSource, 'source');
      exigerDisponible(s, article.ArticleID, source, q, ref, 'Sortie refusée');
      stocks = ajusterStock(stocks, article.ArticleID, source, -q, date);
      break;
    }
    case 'TRANSFERT': {
      exigerQuantite(q);
      source = exigerEmplacement(s, input.EmplacementSource, 'source');
      dest = exigerEmplacement(s, input.EmplacementDestination, 'de destination');
      if (source === dest) refuse('Transfert refusé : la source et la destination sont identiques.');
      exigerDisponible(s, article.ArticleID, source, q, ref, 'Transfert refusé');
      stocks = ajusterStock(stocks, article.ArticleID, source, -q, date);
      stocks = ajusterStock(stocks, article.ArticleID, dest, q, date);
      break;
    }
    case 'STANDBY_DEPART': {
      exigerQuantite(q);
      source = exigerEmplacement(s, input.EmplacementSource, 'source');
      const chantier = input.Chantier?.trim() || input.Destination?.trim();
      if (!chantier) refuse('Chantier obligatoire pour un départ en stand-by.');
      exigerDisponible(s, article.ArticleID, source, q, ref, 'Départ en stand-by refusé');
      stocks = ajusterStock(stocks, article.ArticleID, source, -q, date);
      standbyId = input.StandbyID ?? `SB-${uuidv4()}`;
      if (s.standbys.some((x) => x.StandbyID === standbyId)) refuse(`Stand-by déjà existant : ${standbyId}.`);
      standbys = [
        ...standbys,
        {
          StandbyID: standbyId,
          ArticleID: article.ArticleID,
          EmplacementOrigine: source,
          Quantite: q,
          Chantier: chantier,
          Utilisateur: input.Utilisateur,
          DateSortie: date,
          DateRetour: null,
          Statut: 'ouvert',
          QuantiteRetournee: 0,
          QuantiteConsommee: 0,
        },
      ];
      input = { ...input, Destination: input.Destination || chantier };
      break;
    }
    case 'STANDBY_RETOUR':
    case 'STANDBY_CONSOMME': {
      exigerQuantite(q);
      const idx = s.standbys.findIndex((x) => x.StandbyID === input.StandbyID);
      if (idx < 0) refuse(`Stand-by introuvable : ${input.StandbyID ?? '(non précisé)'}.`);
      const sb = s.standbys[idx];
      if (sb.Statut !== 'ouvert') refuse(`Le stand-by ${sb.StandbyID} est déjà clos.`);
      if (sb.ArticleID !== article.ArticleID) refuse('La référence ne correspond pas au stand-by.');
      const reste = quantiteStandbyRestante(sb);
      if (q > reste) refuse(`Refusé : ${q} demandé(s) mais seulement ${reste} en stand-by sur ce chantier.`);
      standbyId = sb.StandbyID;
      const maj: Standby = { ...sb };
      if (input.Type === 'STANDBY_RETOUR') {
        dest = exigerEmplacement(s, input.EmplacementDestination ?? sb.EmplacementOrigine, 'de retour');
        stocks = ajusterStock(stocks, article.ArticleID, dest, q, date);
        maj.QuantiteRetournee += q;
      } else {
        // Consommé sur chantier : sortie définitive, le stock total diminue.
        maj.QuantiteConsommee += q;
      }
      if (quantiteStandbyRestante(maj) === 0) {
        maj.Statut = 'clos';
        maj.DateRetour = date;
      }
      standbys = s.standbys.slice();
      standbys[idx] = maj;
      if (!input.Destination) input = { ...input, Destination: sb.Chantier };
      break;
    }
    case 'AJUSTEMENT': {
      // Quantite = quantité comptée à l'emplacement (nouvelle valeur).
      if (!Number.isInteger(q) || q < 0) refuse("La quantité comptée doit être un entier positif ou nul.");
      dest = exigerEmplacement(s, input.EmplacementDestination ?? input.EmplacementSource, "d'inventaire");
      ecart = q - quantiteA(s, article.ArticleID, dest);
      if (ecart === 0) refuse('Ajustement inutile : la quantité comptée est égale au stock enregistré.');
      stocks = ajusterStock(stocks, article.ArticleID, dest, ecart, date);
      break;
    }
    default:
      refuse(`Type de mouvement inconnu : ${String((input as MouvementInput).Type)}.`);
  }

  const mouvement: Mouvement = {
    MouvementID: input.MouvementID ?? uuidv4(),
    DateHeure: date,
    Type: input.Type,
    ArticleID: article.ArticleID,
    EmplacementSource: source,
    EmplacementDestination: dest,
    Quantite: q,
    Utilisateur: input.Utilisateur.trim(),
    Motif: input.Motif?.trim() ?? '',
    Destination: input.Destination?.trim() ?? '',
    Commentaire: input.Commentaire?.trim() ?? '',
    ...(standbyId ? { StandbyID: standbyId } : {}),
    ...(ecart !== undefined ? { Ecart: ecart } : {}),
  };

  return {
    ok: true,
    duplicate: false,
    mouvement,
    snapshot: { ...s, stocks, standbys, mouvements: [...s.mouvements, mouvement] },
  };
}
