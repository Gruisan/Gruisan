import { useMemo } from 'react';
import { derniersMouvements, etatArticle, kpis } from '../domain/indexes';
import { useStore } from '../store/useStore';
import { nombre } from '../ui/format';
import { TableMouvements } from '../ui/TableMouvements';

function Carte({ titre, valeur, detail, ton = 'neutre', onClick, testid }: { titre: string; valeur: string; detail?: string; ton?: 'neutre' | 'alerte' | 'danger' | 'info'; onClick?: () => void; testid?: string }) {
  const couleur = { neutre: 'text-white', alerte: 'text-amber-300', danger: 'text-red-400', info: 'text-sky-300' }[ton];
  return (
    <button onClick={onClick} disabled={!onClick} className="carte p-3 text-left transition-colors enabled:hover:border-acier-500" data-testid={testid}>
      <div className="titre-section">{titre}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${couleur}`}>{valeur}</div>
      {detail && <div className="mt-0.5 text-[11px] text-acier-400">{detail}</div>}
    </button>
  );
}

export function PageTableauDeBord() {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const setPage = useStore((s) => s.setPage);
  const localiser = useStore((s) => s.localiser);
  const k = useMemo(() => kpis(snapshot, index), [snapshot, index]);
  const derniers = useMemo(() => derniersMouvements(snapshot, 10), [snapshot]);
  const critiques = useMemo(
    () => snapshot.articles.filter((a) => a.Statut === 'actif' && etatArticle(index, a) !== 'ok').sort((a, b) => (index.disponibleParArticle.get(a.ArticleID) ?? 0) - (index.disponibleParArticle.get(b.ArticleID) ?? 0)),
    [snapshot, index],
  );
  return (
    <div className="h-full overflow-auto p-4" data-testid="page-tableau">
      <h1 className="mb-3 text-base font-semibold text-white">Tableau de bord</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Carte titre="Références" valeur={nombre(k.nbReferences)} detail={`${snapshot.emplacements.length} emplacements`} onClick={() => setPage('inventaire')} testid="kpi-references" />
        <Carte titre="Quantité totale" valeur={nombre(k.quantiteTotale)} detail={`${nombre(k.quantiteDisponible)} dispo. + ${nombre(k.quantiteStandby)} en stand-by`} testid="kpi-quantite" />
        <Carte titre="Disponible" valeur={nombre(k.quantiteDisponible)} detail="Somme des emplacements" testid="kpi-disponible" />
        <Carte titre="Ruptures" valeur={nombre(k.ruptures)} ton={k.ruptures ? 'danger' : 'neutre'} detail="Disponible = 0" onClick={() => setPage('alertes')} testid="kpi-ruptures" />
        <Carte titre="Sous seuil" valeur={nombre(k.sousSeuil)} ton={k.sousSeuil ? 'alerte' : 'neutre'} detail="Disponible < stock mini" onClick={() => setPage('alertes')} testid="kpi-sous-seuil" />
        <Carte titre="Stand-by ouverts" valeur={nombre(k.standbysOuverts)} ton="info" detail={`${nombre(k.quantiteStandby)} unité(s) sur chantier`} onClick={() => setPage('standby')} testid="kpi-standby" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="carte min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-acier-700 px-3 py-2">
            <h2 className="titre-section">10 derniers mouvements</h2>
            <button className="btn-fantome py-0.5" onClick={() => setPage('historique')}>
              Tout l'historique →
            </button>
          </div>
          <div className="overflow-auto">
            <TableMouvements mouvements={derniers} compact />
          </div>
        </section>
        <section className="carte overflow-hidden">
          <div className="border-b border-acier-700 px-3 py-2">
            <h2 className="titre-section">Ruptures et sous-seuils</h2>
          </div>
          <ul className="max-h-[360px] overflow-auto">
            {critiques.map((a) => {
              const d = index.disponibleParArticle.get(a.ArticleID) ?? 0;
              const emps = (index.stocksParArticle.get(a.ArticleID) ?? []).map((s) => s.EmplacementID);
              return (
                <li key={a.ArticleID} className="flex items-center justify-between gap-2 border-b border-acier-800 px-3 py-1.5 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-white">{a.Reference}</div>
                    <div className="truncate text-[11px] text-acier-400">{a.Designation}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={d === 0 ? 'font-semibold text-red-400' : 'font-semibold text-amber-300'}>
                      {d} / {a.StockMinimum}
                    </div>
                    {emps.length > 0 && (
                      <button className="text-[10px] text-sky-300 hover:underline" onClick={() => localiser(emps, { articleId: a.ArticleID })}>
                        localiser
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
