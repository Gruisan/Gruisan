// Fournisseur local : données de démonstration, moteur de stock en mémoire,
// persistance dans le navigateur (IndexedDB > localStorage > mémoire).

import { applyMouvement } from '../domain/engine';
import type { ApplyResult, MouvementInput, Snapshot } from '../domain/types';
import type { DataProvider, StatutDonnees } from './DataProvider';
import { ouvrirMeilleurStockage, type KeyValueStore } from './storage';

const CLE = 'snapshot';

export interface LocalDemoOptions {
  /** Jeu de données initial (démonstration). */
  demo: () => Snapshot;
  /** Stockage imposé (tests) ; sinon détection automatique. */
  store?: KeyValueStore;
}

export function validerSnapshot(x: unknown): Snapshot {
  const s = x as Snapshot;
  if (!s || typeof s !== 'object' || s.schemaVersion !== 1) throw new Error('Format de données non reconnu (schemaVersion).');
  for (const k of ['articles', 'emplacements', 'stocks', 'mouvements', 'standbys'] as const) {
    if (!Array.isArray(s[k])) throw new Error(`Table manquante ou invalide : ${k}.`);
  }
  return s;
}

export class LocalDemoProvider implements DataProvider {
  readonly id = 'local-demo';
  readonly libelle = 'Démo locale';
  private snapshot!: Snapshot;
  private store?: KeyValueStore;
  private file: Promise<unknown> = Promise.resolve();
  private etat: StatutDonnees = {
    source: this.libelle,
    persistance: 'memoire',
    durable: false,
    derniereSauvegarde: null,
    erreur: null,
  };

  constructor(private readonly opts: LocalDemoOptions) {
    this.store = opts.store;
  }

  /** Sérialise les opérations : jamais deux écritures concurrentes. */
  private enFile<T>(f: () => Promise<T>): Promise<T> {
    const p = this.file.then(f, f);
    this.file = p.catch(() => undefined);
    return p;
  }

  async init(): Promise<Snapshot> {
    if (!this.store) {
      const { store, echecs } = await ouvrirMeilleurStockage();
      this.store = store;
      if (echecs.length) this.etat.erreur = echecs.join(' ; ');
    }
    this.etat.persistance = this.store.mode;
    this.etat.durable = this.store.mode !== 'memoire';
    let charge: Snapshot | undefined;
    try {
      const brut = await this.store.get<Snapshot>(CLE);
      if (brut) charge = validerSnapshot(brut);
    } catch (e) {
      this.etat.erreur = `Données locales illisibles, jeu de démonstration rechargé (${(e as Error).message}).`;
    }
    if (charge) {
      this.snapshot = charge;
    } else {
      this.snapshot = this.opts.demo();
      await this.sauver(this.snapshot);
    }
    return this.snapshot;
  }

  getSnapshot(): Snapshot {
    return this.snapshot;
  }

  private async sauver(s: Snapshot) {
    await this.store!.set(CLE, s);
    this.etat.derniereSauvegarde = new Date().toISOString();
  }

  appliquerMouvement(input: MouvementInput): Promise<ApplyResult> {
    return this.enFile(async () => {
      const res = applyMouvement(this.snapshot, input);
      if (!res.ok || res.duplicate) return res;
      try {
        // On persiste avant de valider en mémoire : en cas d'échec, rien n'est modifié.
        await this.sauver(res.snapshot);
      } catch (e) {
        this.etat.erreur = `Échec de sauvegarde : ${(e as Error).message}`;
        return { ok: false as const, error: `Mouvement non enregistré : échec de la sauvegarde locale (${(e as Error).message}).` };
      }
      this.snapshot = res.snapshot;
      return res;
    });
  }

  reinitialiser(): Promise<Snapshot> {
    return this.enFile(async () => {
      const s = this.opts.demo();
      await this.sauver(s);
      this.snapshot = s;
      return s;
    });
  }

  exporterJson(): string {
    return JSON.stringify({ format: 'magasin3d-sauvegarde', exporteLe: new Date().toISOString(), donnees: this.snapshot }, null, 1);
  }

  importerJson(json: string): Promise<Snapshot> {
    const brut = JSON.parse(json);
    return this.remplacerDonnees(validerSnapshot(brut?.format === 'magasin3d-sauvegarde' ? brut.donnees : brut));
  }

  remplacerDonnees(s: Snapshot): Promise<Snapshot> {
    return this.enFile(async () => {
      validerSnapshot(s);
      // Persisté d'abord : en cas d'échec, les données en mémoire restent inchangées.
      await this.sauver(s);
      this.snapshot = s;
      return s;
    });
  }

  statut(): StatutDonnees {
    return { ...this.etat };
  }
}
