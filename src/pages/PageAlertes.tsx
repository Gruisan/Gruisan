import { useMemo } from 'react';
import { etatArticle } from '../domain/indexes';
import { useStore } from '../store/useStore';

// Version phase 1 : ruptures et sous-seuils. Page complète (saturation, incohérences…) en phase 3.
export function PageAlertes() {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const localiser = useStore((s) => s.localiser);
  const alertes = useMemo(
    () =>
      snapshot.articles
        .map((a) => ({ a, e: etatArticle(index, a), d: index.disponibleParArticle.get(a.ArticleID) ?? 0 }))
        .filter((x) => x.a.Statut === 'actif' && x.e !== 'ok')
        .sort((x, y) => (x.e === y.e ? x.d - y.d : x.e === 'rupture' ? -1 : 1)),
    [snapshot, index],
  );
  return (
    <div className="h-full overflow-auto p-4" data-testid="page-alertes">
      <h1 className="mb-1 text-base font-semibold text-white">Alertes</h1>
      <p className="mb-3 text-xs text-acier-400">Phase 1 : ruptures et sous-seuils. Saturation, références sans emplacement et incohérences : phase 3.</p>
      <div className="carte overflow-hidden">
        <table className="table-std">
          <thead>
            <tr>
              <th>Alerte</th>
              <th>Référence</th>
              <th>Désignation</th>
              <th className="text-right">Disponible</th>
              <th className="text-right">Stand-by</th>
              <th className="text-right">Mini</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {alertes.map(({ a, e, d }) => {
              const emps = (index.stocksParArticle.get(a.ArticleID) ?? []).map((s) => s.EmplacementID);
              return (
                <tr key={a.ArticleID}>
                  <td>
                    <span className={`pastille ${e === 'rupture' ? 'bg-red-900 text-red-200' : 'bg-amber-900 text-amber-200'}`}>{e === 'rupture' ? 'Rupture' : 'Sous seuil'}</span>
                  </td>
                  <td className="font-mono font-semibold text-white">{a.Reference}</td>
                  <td className="text-acier-300">{a.Designation}</td>
                  <td className="text-right font-semibold">{d}</td>
                  <td className="text-right text-acier-400">{index.standbyParArticle.get(a.ArticleID) ?? '—'}</td>
                  <td className="text-right text-acier-400">{a.StockMinimum}</td>
                  <td>{emps.length > 0 && <button className="btn-fantome py-0.5" onClick={() => localiser(emps, { articleId: a.ArticleID })}>Localiser</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
