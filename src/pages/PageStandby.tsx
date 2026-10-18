import { useMemo, useState } from 'react';
import { quantiteStandbyRestante } from '../domain/engine';
import { peut } from '../domain/roles';
import { useStore } from '../store/useStore';
import { dateHeure } from '../ui/format';

export function PageStandby() {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const role = useStore((s) => s.role);
  const ouvrirFormulaire = useStore((s) => s.ouvrirFormulaire);
  const localiser = useStore((s) => s.localiser);
  const [voirClos, setVoirClos] = useState(false);
  const liste = useMemo(
    () => snapshot.standbys.filter((s) => voirClos || s.Statut === 'ouvert').sort((a, b) => b.DateSortie.localeCompare(a.DateSortie)),
    [snapshot.standbys, voirClos],
  );
  const ecriture = peut(role, 'mouvement');
  return (
    <div className="flex h-full flex-col p-4" data-testid="page-standby">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-base font-semibold text-white">Stand-by</h1>
        <p className="text-xs text-acier-400">Matériel parti en chantier « au cas où » : compté dans le stock total, mais non disponible.</p>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-acier-300">
          <input type="checkbox" checked={voirClos} onChange={(e) => setVoirClos(e.target.checked)} /> Afficher les clos
        </label>
        <button className="btn-primaire" disabled={!ecriture} onClick={() => ouvrirFormulaire({ type: 'STANDBY_DEPART' })}>
          Nouveau départ
        </button>
      </div>
      <div className="carte min-h-0 flex-1 overflow-auto">
        <table className="table-std">
          <thead>
            <tr>
              <th>Sortie le</th>
              <th>Référence</th>
              <th>Chantier</th>
              <th>Origine</th>
              <th className="text-right">Parti</th>
              <th className="text-right">Revenu</th>
              <th className="text-right">Consommé</th>
              <th className="text-right">En stand-by</th>
              <th>Statut</th>
              <th>Utilisateur</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-acier-500">
                  Aucun stand-by ouvert.
                </td>
              </tr>
            )}
            {liste.map((s) => {
              const a = index.articleParId.get(s.ArticleID);
              const reste = quantiteStandbyRestante(s);
              return (
                <tr key={s.StandbyID} data-testid="ligne-standby">
                  <td className="whitespace-nowrap text-acier-400">{dateHeure(s.DateSortie)}</td>
                  <td>
                    <div className="font-mono font-semibold text-white">{a?.Reference}</div>
                    <div className="max-w-[200px] truncate text-[11px] text-acier-400">{a?.Designation}</div>
                  </td>
                  <td className="text-acier-200">{s.Chantier}</td>
                  <td>
                    <button className="font-mono text-acier-200 hover:text-securite" onClick={() => localiser([s.EmplacementOrigine])}>
                      {s.EmplacementOrigine}
                    </button>
                  </td>
                  <td className="text-right">{s.Quantite}</td>
                  <td className="text-right text-acier-400">{s.QuantiteRetournee || '—'}</td>
                  <td className="text-right text-acier-400">{s.QuantiteConsommee || '—'}</td>
                  <td className="text-right font-semibold">{reste}</td>
                  <td>
                    <span className={`pastille ${s.Statut === 'ouvert' ? 'bg-amber-900 text-amber-200' : 'bg-acier-700 text-acier-400'}`}>{s.Statut}</span>
                    {s.DateRetour && <div className="text-[10px] text-acier-500">{dateHeure(s.DateRetour)}</div>}
                  </td>
                  <td className="text-acier-400">{s.Utilisateur}</td>
                  <td className="whitespace-nowrap">
                    {s.Statut === 'ouvert' && (
                      <div className="flex gap-1">
                        <button className="btn-secondaire py-1" disabled={!ecriture} onClick={() => ouvrirFormulaire({ type: 'STANDBY_RETOUR', standbyId: s.StandbyID })} data-testid="btn-retour">
                          Retour
                        </button>
                        <button className="btn-secondaire py-1" disabled={!ecriture} onClick={() => ouvrirFormulaire({ type: 'STANDBY_CONSOMME', standbyId: s.StandbyID })} data-testid="btn-consomme">
                          Consommé
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
