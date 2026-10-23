import { useRef, useState } from 'react';
import { peut } from '../domain/roles';
import { useStore } from '../store/useStore';
import { dateHeure } from '../ui/format';
import { exporterExcel } from '../ui/excelUi';
import { ImportExcel } from '../ui/ImportExcel';
import { telecharger } from '../ui/telecharger';
import { MAPPING_PAR_DEFAUT } from '../store/useStore';

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
  const mapping = useStore((s) => s.mapping);
  const setMapping = useStore((s) => s.setMapping);
  const [importOuvert, setImportOuvert] = useState(false);
  const [texteMapping, setTexteMapping] = useState(() => JSON.stringify(mapping, null, 2));
  const [msgMapping, setMsgMapping] = useState<{ ok: boolean; texte: string } | null>(null);
  const mappingPerso = JSON.stringify(mapping) !== JSON.stringify(MAPPING_PAR_DEFAUT);
  const enregistrerMapping = (texte: string) => {
    try {
      setMapping(JSON.parse(texte));
      setTexteMapping(JSON.stringify(JSON.parse(texte), null, 2));
      setMsgMapping({ ok: true, texte: 'Mapping enregistré (conservé dans ce navigateur).' });
    } catch (e) {
      setMsgMapping({ ok: false, texte: (e as Error).message });
    }
  };

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

        <section className="carte space-y-3 p-4" data-testid="section-excel">
          <h2 className="titre-section">Import / export Excel</h2>
          <p className="text-[11px] text-acier-400">
            Classeur d'inventaire : une feuille par table ({Object.values(mapping.tables).map((t) => t.feuille).join(', ')}). L'import remplace toutes les données après
            affichage d'un rapport ; rien n'est écrit s'il reste une erreur bloquante.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondaire" onClick={() => exporterExcel()} data-testid="btn-export-excel">
              Exporter en Excel
            </button>
            <button className="btn-secondaire" disabled={!peut(role, 'importer')} onClick={() => setImportOuvert(true)} data-testid="btn-import-excel">
              Importer un classeur…
            </button>
          </div>
          {!peut(role, 'importer') && <p className="text-[11px] text-acier-500">Import réservé au rôle Administrateur (simulé).</p>}
        </section>

        <section className="carte space-y-2 p-4 lg:row-span-2">
          <h2 className="titre-section">
            Mapping des colonnes Excel {mappingPerso && <span className="pastille ml-1 bg-sky-900 text-sky-200">personnalisé</span>}
          </h2>
          <p className="text-[11px] text-acier-400">
            Champ interne → en-tête de colonne. Modifiez les valeurs pour correspondre aux listes SharePoint / Power Apps (casse, accents et espaces ignorés).
            « rejetsBloquants » : true pour refuser tout l'import à la moindre ligne rejetée.
          </p>
          <textarea
            className="champ h-64 font-mono text-[11px] leading-snug"
            spellCheck={false}
            value={texteMapping}
            onChange={(e) => setTexteMapping(e.target.value)}
            disabled={!peut(role, 'importer')}
            data-testid="mapping-json"
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondaire" disabled={!peut(role, 'importer')} onClick={() => enregistrerMapping(texteMapping)}>
              Enregistrer
            </button>
            <button
              className="btn-secondaire"
              disabled={!peut(role, 'importer')}
              onClick={() => {
                setMapping(null);
                setTexteMapping(JSON.stringify(MAPPING_PAR_DEFAUT, null, 2));
                setMsgMapping({ ok: true, texte: 'Mapping par défaut rétabli.' });
              }}
            >
              Par défaut
            </button>
            <button className="btn-fantome" onClick={() => telecharger('import-mapping.json', JSON.stringify(mapping, null, 2), 'application/json')}>
              Télécharger
            </button>
            <label className={`btn-fantome ${peut(role, 'importer') ? 'cursor-pointer' : 'pointer-events-none opacity-40'}`}>
              Charger un fichier…
              <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) enregistrerMapping(await f.text());
              }} />
            </label>
          </div>
          {msgMapping && <p className={`text-xs ${msgMapping.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msgMapping.texte}</p>}
        </section>

        <section className="carte space-y-3 p-4">
          <h2 className="titre-section">Sauvegarde fichier (JSON)</h2>
          <p className="text-[11px] text-acier-400">
            Copie complète des données, indépendante du navigateur. À utiliser pour transférer les données d'un poste à l'autre ou si le navigateur efface son stockage.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondaire" onClick={() => telecharger(`magasin3d-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, provider.exporterJson(), 'application/json')} data-testid="btn-export-json">
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
      {importOuvert && <ImportExcel fermer={() => setImportOuvert(false)} />}
    </div>
  );
}
