// Assistant d'import Excel : analyse (sans écriture) → rapport → confirmation → remplacement tout-ou-rien.
import { useMemo, useState } from 'react';
import { importerClasseur, LIBELLE_TABLE, lireClasseur, TABLES, type RapportImport } from '../domain/excel';
import { emplacementsDepuisLayout } from '../domain/layout';
import { useStore } from '../store/useStore';
import { exporterExcel, rapportCsv } from './excelUi';
import { nombre } from './format';
import { Icone } from './Icone';
import { telecharger } from './telecharger';

const MAX_LIGNES = 300;

export function ImportExcel({ fermer }: { fermer: () => void }) {
  const mapping = useStore((s) => s.mapping);
  const layout = useStore((s) => s.layout)!;
  const provider = useStore((s) => s.provider)!;
  const snapshot = useStore((s) => s.snapshot);
  const [fichier, setFichier] = useState<File | null>(null);
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etape, setEtape] = useState<'choix' | 'analyse' | 'rapport' | 'ecriture' | 'fini'>('choix');
  const empsLayout = useMemo(() => emplacementsDepuisLayout(layout).map((e) => e.EmplacementID), [layout]);

  const analyser = async (f: File) => {
    setFichier(f);
    setErreur(null);
    setEtape('analyse');
    try {
      const wb = lireClasseur(await f.arrayBuffer());
      setRapport(importerClasseur(wb, mapping, { emplacementsLayout: empsLayout }));
      setEtape('rapport');
    } catch (e) {
      setErreur(`Fichier illisible : ${(e as Error).message}`);
      setEtape('choix');
    }
  };

  const appliquer = async () => {
    if (!rapport?.snapshot || rapport.bloquant) return;
    setEtape('ecriture');
    try {
      const s = await provider.remplacerDonnees(rapport.snapshot);
      useStore.getState().remplacerSnapshot(s);
      useStore.getState().selectionner(null);
      useStore.getState().effacerSurbrillance();
      useStore.getState().notifier('succes', `Import Excel « ${fichier?.name} » : ${s.articles.length} articles, ${s.stocks.length} stocks, ${s.mouvements.length} mouvements.`);
      setEtape('fini');
    } catch (e) {
      setErreur(`Écriture refusée, données inchangées : ${(e as Error).message}`);
      setEtape('rapport');
    }
  };

  const problemes = rapport ? [...rapport.erreursBloquantes.map((p) => ({ ...p, bloquant: true })), ...rapport.rejets.map((p) => ({ ...p, bloquant: false }))] : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && etape !== 'ecriture' && fermer()}>
      <div className="carte flex max-h-full w-full max-w-4xl flex-col bg-acier-900 shadow-2xl" data-testid="import-excel">
        <div className="flex items-center justify-between border-b border-acier-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white">Import Excel {fichier && <span className="font-normal text-acier-400">— {fichier.name}</span>}</h2>
          <button className="btn-fantome px-1.5" onClick={fermer} disabled={etape === 'ecriture'} aria-label="Fermer">
            <Icone nom="fermer" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-xs">
          {etape === 'choix' && (
            <div className="space-y-3">
              <p className="text-acier-300">
                Le classeur doit contenir une feuille par table ({TABLES.map((t) => mapping.tables[t].feuille).join(', ')}) avec les en-têtes définis par le mapping (Paramètres).
                L'import <b>remplace</b> toutes les données. Rien n'est écrit avant votre confirmation, et rien du tout s'il reste une erreur bloquante.
              </p>
              <label className="btn-primaire cursor-pointer">
                Choisir un fichier .xlsx…
                <input type="file" accept=".xlsx,.xls,.xlsm" className="hidden" data-testid="fichier-excel" onChange={(e) => e.target.files?.[0] && void analyser(e.target.files[0])} />
              </label>
            </div>
          )}
          {etape === 'analyse' && <p className="text-acier-300">Analyse en cours…</p>}
          {erreur && (
            <div className="rounded border border-red-800 bg-red-950/60 p-2 text-red-200" role="alert">
              {erreur}
            </div>
          )}
          {etape === 'fini' && (
            <div className="rounded border border-emerald-800 bg-emerald-950/50 p-3 text-emerald-200" data-testid="import-termine">
              Import terminé : les données ont été remplacées et enregistrées.
            </div>
          )}
          {rapport && etape !== 'choix' && etape !== 'analyse' && (
            <>
              <div
                className={`rounded border p-2 ${rapport.bloquant ? 'border-red-800 bg-red-950/50 text-red-200' : rapport.rejets.length ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-emerald-800 bg-emerald-950/40 text-emerald-200'}`}
                data-testid="verdict-import"
              >
                {rapport.bloquant
                  ? `Import bloqué : ${rapport.erreursBloquantes.length} erreur(s) bloquante(s)${mapping.options?.rejetsBloquants && rapport.rejets.length ? ` et ${rapport.rejets.length} ligne(s) rejetée(s) (option « rejets bloquants » active)` : ''}. Aucune donnée ne sera écrite.`
                  : rapport.rejets.length
                    ? `${rapport.rejets.length} ligne(s) rejetée(s) : elles seront ignorées si vous confirmez. Le reste est valide.`
                    : 'Classeur valide : aucune ligne rejetée.'}
              </div>
              <table className="table-std">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Feuille</th>
                    <th className="text-right">Lignes lues</th>
                    <th className="text-right">Acceptées</th>
                    <th className="text-right">Rejetées</th>
                    <th className="text-right">Actuellement</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLES.map((t) => (
                    <tr key={t}>
                      <td>{LIBELLE_TABLE[t]}</td>
                      <td className="font-mono text-acier-400">{mapping.tables[t].feuille}</td>
                      <td className="text-right">{nombre(rapport.compte[t].lues)}</td>
                      <td className="text-right text-emerald-300">{rapport.bloquant ? '—' : nombre(rapport.compte[t].acceptees)}</td>
                      <td className={`text-right ${rapport.compte[t].rejetees ? 'font-semibold text-amber-300' : 'text-acier-500'}`}>{nombre(rapport.compte[t].rejetees)}</td>
                      <td className="text-right text-acier-400">{nombre(snapshot[t].length)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {problemes.length > 0 && (
                <div>
                  <div className="titre-section mb-1">Lignes rejetées et erreurs ({problemes.length})</div>
                  <div className="max-h-72 overflow-auto rounded border border-acier-700">
                    <table className="table-std" data-testid="rejets-import">
                      <thead>
                        <tr>
                          <th>Gravité</th>
                          <th>Feuille</th>
                          <th className="text-right">Ligne</th>
                          <th>Colonne</th>
                          <th>Valeur</th>
                          <th>Raison</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemes.slice(0, MAX_LIGNES).map((p, i) => (
                          <tr key={i}>
                            <td>
                              <span className={`pastille ${p.bloquant ? 'bg-red-900 text-red-200' : 'bg-amber-900 text-amber-200'}`}>{p.bloquant ? 'Bloquant' : 'Rejet'}</span>
                            </td>
                            <td className="font-mono">{p.feuille}</td>
                            <td className="text-right">{p.ligne ?? '—'}</td>
                            <td>{p.colonne ?? '—'}</td>
                            <td className="max-w-[140px] truncate font-mono">{p.valeur ?? ''}</td>
                            <td className="text-acier-200">{p.raison}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {problemes.length > MAX_LIGNES && <p className="mt-1 text-acier-500">… {problemes.length - MAX_LIGNES} de plus : téléchargez le rapport complet.</p>}
                </div>
              )}
              {rapport.avertissements.length > 0 && (
                <div>
                  <div className="titre-section mb-1">Avertissements ({rapport.avertissements.length})</div>
                  <ul className="list-disc space-y-0.5 pl-5 text-acier-300">
                    {rapport.avertissements.slice(0, 50).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-acier-700 px-4 py-2.5">
          {rapport && fichier && (
            <button className="btn-fantome mr-auto" onClick={() => telecharger(`rapport-import-${fichier.name.replace(/\.\w+$/, '')}.csv`, rapportCsv(rapport, fichier.name), 'text/csv;charset=utf-8')}>
              Télécharger le rapport (CSV)
            </button>
          )}
          {etape === 'rapport' && (
            <>
              <button className="btn-secondaire" onClick={() => (setRapport(null), setFichier(null), setEtape('choix'))}>
                Autre fichier
              </button>
              {!rapport?.bloquant && (
                <button className="btn-secondaire" onClick={() => exporterExcel(`SAUVEGARDE_AVANT_IMPORT_${new Date().toISOString().slice(0, 10)}.xlsx`)}>
                  Sauvegarder les données actuelles
                </button>
              )}
              <button className="btn-primaire" disabled={!rapport || rapport.bloquant} onClick={() => void appliquer()} data-testid="btn-confirmer-import">
                Remplacer les données
              </button>
            </>
          )}
          {(etape === 'fini' || etape === 'choix') && (
            <button className="btn-secondaire" onClick={fermer}>
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
