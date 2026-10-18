import { useMemo, useState } from 'react';
import { etatArticle, type EtatArticle } from '../domain/indexes';
import { peut } from '../domain/roles';
import { useStore } from '../store/useStore';
import { nombre } from '../ui/format';

const ETAT: Record<EtatArticle, { libelle: string; classe: string }> = {
  rupture: { libelle: 'Rupture', classe: 'bg-red-900 text-red-200' },
  'sous-seuil': { libelle: 'Sous seuil', classe: 'bg-amber-900 text-amber-200' },
  ok: { libelle: 'OK', classe: 'bg-acier-700 text-acier-300' },
};
const PAR_PAGE = 100;

export function PageInventaire() {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const localiser = useStore((s) => s.localiser);
  const ouvrirFormulaire = useStore((s) => s.ouvrirFormulaire);
  const role = useStore((s) => s.role);
  const [filtre, setFiltre] = useState('');
  const [categorie, setCategorie] = useState('');
  const [etat, setEtat] = useState<EtatArticle | ''>('');
  const [page, setPage] = useState(0);
  const categories = useMemo(() => [...new Set(snapshot.articles.map((a) => a.Categorie))].sort(), [snapshot.articles]);
  const lignes = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return snapshot.articles.filter((a) => {
      if (categorie && a.Categorie !== categorie) return false;
      if (etat && etatArticle(index, a) !== etat) return false;
      if (f && ![a.Reference, a.Designation, a.Constructeur, a.Categorie].some((x) => x.toLowerCase().includes(f))) return false;
      return true;
    });
  }, [snapshot.articles, index, filtre, categorie, etat]);
  const nbPages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  const p = Math.min(page, nbPages - 1);

  return (
    <div className="flex h-full flex-col p-4" data-testid="page-inventaire">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-3 text-base font-semibold text-white">Inventaire</h1>
        <input className="champ w-64" placeholder="Filtrer…" value={filtre} onChange={(e) => (setFiltre(e.target.value), setPage(0))} />
        <select className="champ w-48" value={categorie} onChange={(e) => (setCategorie(e.target.value), setPage(0))}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="champ w-36" value={etat} onChange={(e) => (setEtat(e.target.value as EtatArticle | ''), setPage(0))}>
          <option value="">Tous états</option>
          <option value="rupture">Rupture</option>
          <option value="sous-seuil">Sous seuil</option>
          <option value="ok">OK</option>
        </select>
        <span className="ml-auto text-xs text-acier-400">{nombre(lignes.length)} référence(s)</span>
      </div>
      <div className="carte min-h-0 flex-1 overflow-auto">
        <table className="table-std">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              <th>Constructeur</th>
              <th className="text-right">Dispo.</th>
              <th className="text-right">Stand-by</th>
              <th className="text-right">Total</th>
              <th className="text-right">Mini</th>
              <th>État</th>
              <th>Emplacements</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lignes.slice(p * PAR_PAGE, (p + 1) * PAR_PAGE).map((a) => {
              const d = index.disponibleParArticle.get(a.ArticleID) ?? 0;
              const sb = index.standbyParArticle.get(a.ArticleID) ?? 0;
              const e = etatArticle(index, a);
              const stocks = index.stocksParArticle.get(a.ArticleID) ?? [];
              return (
                <tr key={a.ArticleID}>
                  <td className="font-mono font-semibold text-white">{a.Reference}</td>
                  <td className="max-w-[240px] truncate text-acier-300">{a.Designation}</td>
                  <td className="text-acier-400">{a.Categorie}</td>
                  <td className="text-acier-400">{a.Constructeur}</td>
                  <td className="text-right font-semibold tabular-nums">{nombre(d)}</td>
                  <td className="text-right tabular-nums text-acier-400">{sb ? nombre(sb) : '—'}</td>
                  <td className="text-right tabular-nums">{nombre(d + sb)}</td>
                  <td className="text-right tabular-nums text-acier-400">{a.StockMinimum}</td>
                  <td>
                    <span className={`pastille ${ETAT[e].classe}`}>{ETAT[e].libelle}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {stocks.map((s) => (
                        <button
                          key={s.EmplacementID}
                          className="rounded bg-acier-800 px-1 font-mono text-[10px] text-acier-200 hover:bg-acier-700"
                          onClick={() => localiser(stocks.map((x) => x.EmplacementID), { focus: s.EmplacementID, articleId: a.ArticleID })}
                        >
                          {s.EmplacementID} ×{s.Quantite}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button className="btn-fantome py-0.5" disabled={!peut(role, 'mouvement')} onClick={() => ouvrirFormulaire({ type: 'ENTREE', articleId: a.ArticleID, destination: stocks[0]?.EmplacementID })}>
                      Mouvement
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nbPages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs">
          <button className="btn-secondaire" disabled={p === 0} onClick={() => setPage(p - 1)}>
            ←
          </button>
          <span>
            Page {p + 1} / {nbPages}
          </span>
          <button className="btn-secondaire" disabled={p >= nbPages - 1} onClick={() => setPage(p + 1)}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
