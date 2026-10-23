// Contrat d'accès aux données. L'UI ne parle qu'à cette interface :
// LocalDemoProvider aujourd'hui, SharePointListsProvider demain (phase 5), sans changer l'UI.

import type { ApplyResult, MouvementInput, Snapshot } from '../domain/types';

export type ModePersistance = 'indexeddb' | 'localstorage' | 'memoire' | 'distant';

export interface StatutDonnees {
  source: string;
  persistance: ModePersistance;
  /** true si les données survivent à la fermeture du fichier. */
  durable: boolean;
  derniereSauvegarde: string | null;
  erreur: string | null;
}

export interface DataProvider {
  readonly id: string;
  readonly libelle: string;
  /** Charge les données (ou initialise le jeu de démonstration). */
  init(): Promise<Snapshot>;
  getSnapshot(): Snapshot;
  /** Applique et persiste un mouvement ; idempotent sur MouvementID. */
  appliquerMouvement(input: MouvementInput): Promise<ApplyResult>;
  /** Remet le jeu de démonstration d'origine. */
  reinitialiser(): Promise<Snapshot>;
  /** Sauvegarde complète au format JSON (alternative/secours à la persistance du navigateur). */
  exporterJson(): string;
  importerJson(json: string): Promise<Snapshot>;
  /** Remplace toutes les données (import Excel validé). Tout ou rien. */
  remplacerDonnees(s: Snapshot): Promise<Snapshot>;
  statut(): StatutDonnees;
}
