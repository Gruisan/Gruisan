import { useRef, useState } from 'react';
import { peut } from '../domain/roles';
import { useStore } from '../store/useStore';
import { dateHeure } from '../ui/format';

function telecharger(nom: string, contenu: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PageParametres() {
  const provider = useStore((s) => s.provider)!;
  const statut = useStore((s) => s.statut);
  const utilisateur = useStore((s) => s.utilisateur);
  const setUtilisateur = useStore((s) => s.setUtilisateur);
  const afficherFps = useStore((s) => s.afficherFps);
  const setAfficherFps = useStore((s) => s.setAfficherFps);
  const qualite = useStore((s) => s.qualite);
  const setQualite = useStore((s) => s.setQualite);
  const role = useStore((s) => s.role);
  const remplacer = useStore((s) => s.remplacerSnapshot);
  const notifier = useStore((s) => s.notifier);
  const fichier = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const admin = peut(role, 'reinitialiser');

  const importer = async (f: File) => {
    try {
      const s = await provider.importerJson(await f.text());
      remplacer(s);
      notifier('succes', `Sauvegarde importée : ${f.name}`);
      setMessage(`Import réussi : ${s.articles.length} articles, ${s.mouvements.length} mouvements.`);
    } catch (e) {
      notifier('erreur', `Import refusé : ${(e as Error).message}`);
      setMessage(`Import refusé : ${(e as Error).message}`);
    }
  };

  return (
    <div className="h-full overflow-auto p-4" data-testid="page-parametres">
      <h1 className="mb-3 text-base font-semibold text-white">Paramètres</h1>
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <section className="carte space-y-3 p-4">
          <h2 className="titre-section">Utilisateur</h2>
          <div>
            <label className="etiquette">Nom enregistré dans les mouvements</label>
            <input className="champ" value={utilisateur} onChange={(e) => setUtilisateur(e.target.value)} />
          </div>
          <p className="text-[11px] text-acier-500">Rôle et utilisateur sont simulés : aucune authentification, aucune sécurité réelle.</p>
        </section>

        <section className="carte space-y-2 p-4 text-xs">
          <h2 className="titre-section">Source de données</h2>
          <div>Source : <b>{statut?.source}</b> ({provider.id})</div>
          <div>
            Persistance : <b>{statut?.persistance}</b> {statut?.durable ? '— conservée à la fermeture du fichier' : '— NON conservée (exportez vos données)'}
          </div>
          <div>Dernier enregistrement : {dateHeure(statut?.derniereSauvegarde)}</div>
          {statut?.erreur && <div className="text-amber-300">{statut.erreur}</div>}
          <p className="text-[11px] text-acier-500">Le connecteur SharePoint (listes) sera préparé en phase 5 ; il n'est pas branché.</p>
        </section>

        <section className="carte space-y-3 p-4">
          <h2 className="titre-section">Sauvegarde fichier (JSON)</h2>
          <p className="text-[11px] text-acier-400">
            Copie complète des données, indépendante du navigateur. À utiliser pour transférer les données d'un poste à l'autre ou si le navigateur efface son stockage.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondaire" onClick={() => telecharger(`magasin3d-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, provider.exporterJson())} data-testid="btn-export-json">
              Exporter
            </button>
            <button className="btn-secondaire" disabled={!peut(role, 'importer')} onClick={() => fichier.current?.click()}>
              Importer…
            </button>
            <input
              ref={fichier}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importer(f);
                e.target.value = '';
              }}
            />
          </div>
          {message && <p className="text-xs text-acier-300">{message}</p>}
          {!peut(role, 'importer') && <p className="text-[11px] text-acier-500">Import réservé au rôle Administrateur (simulé).</p>}
        </section>

        <section className="carte space-y-3 p-4">
          <h2 className="titre-section">Démonstration</h2>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={afficherFps} onChange={(e) => setAfficherFps(e.target.checked)} data-testid="toggle-fps" />
            Afficher le compteur d'images/s (stats.js) dans la vue 3D
          </label>
          <label className="flex items-center gap-2 text-xs">
            Qualité graphique
            <select className="champ w-auto py-1 text-xs" value={qualite} onChange={(e) => setQualite(e.target.value as 'haute' | 'eco')} data-testid="choix-qualite">
              <option value="haute">Haute (anticrénelage)</option>
              <option value="eco">Économie (GPU faible)</option>
            </select>
          </label>
          <button
            className="btn-secondaire"
            disabled={!admin}
            onClick={async () => {
              if (!confirm('Réinitialiser toutes les données avec le jeu de démonstration ? Les mouvements saisis seront perdus.')) return;
              remplacer(await provider.reinitialiser());
              notifier('info', 'Jeu de démonstration rechargé.');
            }}
          >
            Réinitialiser les données de démonstration
          </button>
          {!admin && <p className="text-[11px] text-acier-500">Réservé au rôle Administrateur (simulé).</p>}
        </section>
      </div>
    </div>
  );
}
