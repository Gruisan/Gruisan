// Modèle de données du magasin. Les noms de champs reprennent ceux du cahier des charges
// pour faciliter le futur alignement sur les listes SharePoint / Power Apps.

export type StatutArticle = 'actif' | 'obsolete';

export interface Article {
  ArticleID: string;
  Reference: string;
  Designation: string;
  Categorie: string;
  Constructeur: string;
  Description: string;
  StockMinimum: number;
  StockMaximum?: number;
  Unite: string;
  Statut: StatutArticle;
}

export interface Emplacement {
  /** Format : ZONE-RAYONNAGE-NIVEAU-POSITION, ex. A-A01-N02-E03 */
  EmplacementID: string;
  Zone: string;
  Rayonnage: string;
  Niveau: string;
  Position: string;
  /** Capacité indicative en unités (sert au taux d'occupation). */
  Capacite: number;
}

export interface Stock {
  StockID: string;
  ArticleID: string;
  EmplacementID: string;
  Quantite: number;
  /** Incrémentée à chaque modification (verrouillage optimiste futur). */
  Version: number;
  DateModification: string;
}

export const TYPES_MOUVEMENT = [
  'ENTREE',
  'SORTIE',
  'TRANSFERT',
  'STANDBY_DEPART',
  'STANDBY_RETOUR',
  'STANDBY_CONSOMME',
  'AJUSTEMENT',
] as const;
export type TypeMouvement = (typeof TYPES_MOUVEMENT)[number];

export const LIBELLES_MOUVEMENT: Record<TypeMouvement, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
  TRANSFERT: 'Transfert',
  STANDBY_DEPART: 'Départ stand-by',
  STANDBY_RETOUR: 'Retour stand-by',
  STANDBY_CONSOMME: 'Stand-by consommé',
  AJUSTEMENT: 'Ajustement',
};

export interface Mouvement {
  MouvementID: string;
  DateHeure: string;
  Type: TypeMouvement;
  ArticleID: string;
  EmplacementSource: string | null;
  EmplacementDestination: string | null;
  /**
   * Quantité déplacée (toujours > 0).
   * Exception AJUSTEMENT : quantité comptée (nouvelle valeur, >= 0) à l'emplacement.
   */
  Quantite: number;
  Utilisateur: string;
  Motif: string;
  Destination: string;
  Commentaire: string;
  /** Extension : lien vers le stand-by concerné (STANDBY_*). */
  StandbyID?: string;
  /** Extension : écart appliqué (AJUSTEMENT), signé. */
  Ecart?: number;
}

export type StatutStandby = 'ouvert' | 'clos';

export interface Standby {
  StandbyID: string;
  ArticleID: string;
  EmplacementOrigine: string;
  /** Quantité partie en chantier. */
  Quantite: number;
  Chantier: string;
  Utilisateur: string;
  DateSortie: string;
  DateRetour: string | null;
  Statut: StatutStandby;
  /** Extensions : retours et consommations partiels cumulés. */
  QuantiteRetournee: number;
  QuantiteConsommee: number;
}

/** Données d'inventaire (hors géométrie, qui vit dans layout.json). */
export interface Snapshot {
  schemaVersion: 1;
  articles: Article[];
  emplacements: Emplacement[];
  stocks: Stock[];
  mouvements: Mouvement[];
  standbys: Standby[];
}

/** Saisie d'un mouvement (le moteur complète l'ID et l'horodatage si absents). */
export interface MouvementInput {
  MouvementID?: string;
  DateHeure?: string;
  Type: TypeMouvement;
  ArticleID: string;
  EmplacementSource?: string | null;
  EmplacementDestination?: string | null;
  Quantite: number;
  Utilisateur: string;
  Motif?: string;
  Destination?: string;
  Commentaire?: string;
  /** STANDBY_DEPART : nom du chantier. */
  Chantier?: string;
  /** STANDBY_RETOUR / STANDBY_CONSOMME : stand-by visé. */
  StandbyID?: string;
}

export type ApplyResult =
  | { ok: true; snapshot: Snapshot; mouvement: Mouvement; duplicate: boolean }
  | { ok: false; error: string };
