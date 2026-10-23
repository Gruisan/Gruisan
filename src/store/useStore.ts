// Store applicatif (Zustand). Toutes les données d'inventaire viennent du DataProvider ;
// les composants ne lisent que ce store.

import { create } from 'zustand';
import { construireIndex, type Index } from '../domain/indexes';
import type { Layout } from '../domain/layout';
import { validerMapping, type MappingImport } from '../domain/excel';
import mappingParDefaut from '../../config/import-mapping.json';
import type { ApplyResult, MouvementInput, Snapshot, TypeMouvement } from '../domain/types';
import { emptySnapshot } from '../domain/engine';
import type { DataProvider, StatutDonnees } from '../providers/DataProvider';

export type Page =
  | 'tableau'
  | 'magasin'
  | 'inventaire'
  | 'mouvements'
  | 'standby'
  | 'historique'
  | 'alertes'
  | 'editeur'
  | 'parametres';

export type { Role } from '../domain/roles';
import type { Role } from '../domain/roles';

export type Selection = { type: 'rayonnage'; id: string } | { type: 'emplacement'; id: string } | null;

export type VueCamera = 'orbite' | 'dessus' | 'iso';

export interface Formulaire {
  type: TypeMouvement;
  articleId?: string;
  source?: string;
  destination?: string;
  standbyId?: string;
}

export interface Evenement {
  id: number;
  date: string;
  niveau: 'info' | 'succes' | 'erreur';
  texte: string;
}

interface AppState {
  provider: DataProvider | null;
  layout: Layout | null;
  snapshot: Snapshot;
  index: Index;
  statut: StatutDonnees | null;
  pret: boolean;
  erreurInit: string | null;

  page: Page;
  selection: Selection;
  /** Emplacements mis en surbrillance (résultat de recherche, référence sélectionnée). */
  surbrillance: string[];
  /** Article à l'origine de la surbrillance. */
  articleLocalise: string | null;
  /** Demande de cadrage caméra (nonce pour rejouer la même cible). */
  focus: { emplacementId: string; nonce: number } | null;
  vue: { mode: VueCamera; nonce: number };
  formulaire: Formulaire | null;
  evenements: Evenement[];
  utilisateur: string;
  role: Role;
  afficherFps: boolean;
  /** Qualité graphique : 'haute' (anticrénelage, densité ≤ 1,5) ou 'eco' (GPU faibles). */
  qualite: 'haute' | 'eco';
  /** Mapping des colonnes Excel (config/import-mapping.json, modifiable dans Paramètres). */
  mapping: MappingImport;

  init(provider: DataProvider, layout: Layout): Promise<void>;
  appliquer(input: MouvementInput): Promise<ApplyResult>;
  remplacerSnapshot(s: Snapshot): void;
  setPage(p: Page): void;
  selectionner(s: Selection): void;
  localiser(emplacements: string[], options?: { focus?: string; articleId?: string | null }): void;
  effacerSurbrillance(): void;
  setVue(mode: VueCamera): void;
  ouvrirFormulaire(f: Formulaire | null): void;
  notifier(niveau: Evenement['niveau'], texte: string): void;
  setUtilisateur(u: string): void;
  setRole(r: Role): void;
  setAfficherFps(v: boolean): void;
  setQualite(q: 'haute' | 'eco'): void;
  /** null : revient au mapping livré. Lève une erreur si le mapping est invalide. */
  setMapping(m: MappingImport | null): void;
}

let compteurEvenement = 0;
let compteurNonce = 0;

function lirePref<T>(k: string, defaut: T): T {
  try {
    const v = localStorage.getItem(`magasin3d:pref:${k}`);
    return v == null ? defaut : (JSON.parse(v) as T);
  } catch {
    return defaut;
  }
}
export const MAPPING_PAR_DEFAUT = validerMapping(mappingParDefaut);

function lireMapping(): MappingImport {
  const m = lirePref<MappingImport | null>('mapping', null);
  if (!m) return MAPPING_PAR_DEFAUT;
  try {
    return validerMapping(m);
  } catch {
    return MAPPING_PAR_DEFAUT;
  }
}

function ecrirePref(k: string, v: unknown) {
  try {
    localStorage.setItem(`magasin3d:pref:${k}`, JSON.stringify(v));
  } catch {
    /* préférences non persistées : sans conséquence */
  }
}

export const useStore = create<AppState>((set, get) => ({
  provider: null,
  layout: null,
  snapshot: emptySnapshot(),
  index: construireIndex(emptySnapshot()),
  statut: null,
  pret: false,
  erreurInit: null,

  page: 'magasin',
  selection: null,
  surbrillance: [],
  articleLocalise: null,
  focus: null,
  vue: { mode: 'orbite', nonce: 0 },
  formulaire: null,
  evenements: [],
  utilisateur: lirePref('utilisateur', 'demo.magasinier'),
  role: lirePref<Role>('role', 'magasinier'),
  afficherFps: lirePref('fps', false),
  qualite: lirePref<'haute' | 'eco'>('qualite', 'haute'),
  mapping: lireMapping(),

  async init(provider, layout) {
    try {
      const snapshot = await provider.init();
      set({ provider, layout, snapshot, index: construireIndex(snapshot), statut: provider.statut(), pret: true });
      const st = provider.statut();
      if (!st.durable) get().notifier('erreur', 'Persistance indisponible : les mouvements seront perdus à la fermeture. Utilisez l’export JSON (Paramètres).');
      else get().notifier('info', `Données chargées (${st.persistance === 'indexeddb' ? 'IndexedDB' : 'localStorage'}).`);
    } catch (e) {
      set({ erreurInit: (e as Error).message, pret: true, layout });
    }
  },

  async appliquer(input) {
    const p = get().provider;
    if (!p) return { ok: false, error: 'Données non chargées.' };
    const res = await p.appliquerMouvement(input);
    if (res.ok) {
      if (!res.duplicate) get().remplacerSnapshot(res.snapshot);
      const a = get().index.articleParId.get(res.mouvement.ArticleID);
      get().notifier(
        res.duplicate ? 'info' : 'succes',
        res.duplicate
          ? `Mouvement déjà enregistré (${res.mouvement.MouvementID.slice(0, 8)}…) : ignoré.`
          : `${libelleCourt(res.mouvement.Type)} ${a?.Reference ?? res.mouvement.ArticleID} × ${res.mouvement.Quantite} ${trajet(res.mouvement.EmplacementSource, res.mouvement.EmplacementDestination)}`,
      );
    } else {
      get().notifier('erreur', res.error);
    }
    set({ statut: p.statut() });
    return res;
  },

  remplacerSnapshot(snapshot) {
    const p = get().provider;
    set({ snapshot, index: construireIndex(snapshot), statut: p ? p.statut() : null });
  },

  setPage: (page) => set({ page }),
  selectionner: (selection) => set({ selection }),
  localiser(emplacements, options) {
    const focus = options?.focus ?? emplacements[0];
    set({
      page: 'magasin',
      surbrillance: emplacements,
      articleLocalise: options?.articleId ?? null,
      selection: focus ? { type: 'emplacement', id: focus } : get().selection,
      focus: focus ? { emplacementId: focus, nonce: ++compteurNonce } : null,
    });
  },
  effacerSurbrillance: () => set({ surbrillance: [], articleLocalise: null }),
  setVue: (mode) => set({ vue: { mode, nonce: ++compteurNonce } }),
  ouvrirFormulaire: (formulaire) => set({ formulaire }),
  notifier(niveau, texte) {
    const e: Evenement = { id: ++compteurEvenement, date: new Date().toISOString(), niveau, texte };
    set({ evenements: [e, ...get().evenements].slice(0, 50) });
  },
  setUtilisateur(utilisateur) {
    ecrirePref('utilisateur', utilisateur);
    set({ utilisateur });
  },
  setRole(role) {
    ecrirePref('role', role);
    set({ role });
  },
  setAfficherFps(afficherFps) {
    ecrirePref('fps', afficherFps);
    set({ afficherFps });
  },
  setQualite(qualite) {
    ecrirePref('qualite', qualite);
    set({ qualite });
  },
  setMapping(m) {
    const mapping = m ? validerMapping(m) : MAPPING_PAR_DEFAUT;
    ecrirePref('mapping', m ? mapping : null);
    set({ mapping });
  },
}));

function libelleCourt(t: TypeMouvement): string {
  return {
    ENTREE: 'Entrée',
    SORTIE: 'Sortie',
    TRANSFERT: 'Transfert',
    STANDBY_DEPART: 'Stand-by',
    STANDBY_RETOUR: 'Retour stand-by',
    STANDBY_CONSOMME: 'Stand-by consommé',
    AJUSTEMENT: 'Ajustement',
  }[t];
}

function trajet(src: string | null, dst: string | null): string {
  if (src && dst) return `${src} → ${dst}`;
  if (src) return `depuis ${src}`;
  if (dst) return `vers ${dst}`;
  return '';
}
