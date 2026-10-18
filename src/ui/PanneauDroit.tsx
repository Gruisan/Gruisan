import { useMemo, useState } from 'react';
import { statsRayonnage, tauxOccupation } from '../domain/indexes';
import { peut } from '../domain/roles';
import { LIBELLES_MOUVEMENT, type TypeMouvement } from '../domain/types';
import { useStore } from '../store/useStore';
import { couleurOccupation, dateHeure, nombre, pct } from './format';
import { Icone } from './Icone';

export function PanneauDroit() {
  const selection = useStore((s) => s.selection);
  const selectionner = useStore((s) => s.selectionner);
  if (!selection) return null;
  return (
    <div className="flex h-full flex-col bg-acier-900" data-testid="panneau-droit">
      <div className="flex items-center justify-between border-b border-acier-800 px-3 py-2">
        <span className="titre-section">{selection.type === 'rayonnage' ? 'Rayonnage' : 'Emplacement'}</span>
        <button className="btn-fantome px-1.5 py-1" onClick={() => selectionner(null)} aria-label="Fermer le panneau">
          <Icone nom="fermer" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {selection.type === 'rayonnage' ? <PanneauRayonnage id={selection.id} /> : <PanneauEmplacement id={selection.id} />}
      </div>
    </div>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-acier-800 py-1.5 text-xs">
      <span className="text-acier-400">{libelle}</span>
      <span className="font-medium text-acier-100">{valeur}</span>
    </div>
  );
}

function Jauge({ taux }: { taux: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-acier-700">
      <div className="h-full" style={{ width: `${Math.min(100, taux * 100)}%`, background: couleurOccupation(taux, taux === 0) }} />
    </div>
  );
}

function PanneauRayonnage({ id }: { id: string }) {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const layout = useStore((s) => s.layout)!;
  const selectionner = useStore((s) => s.selectionner);
  const surbrillance = useStore((s) => s.surbrillance);
  const r = layout.rayonnages.find((x) => x.id === id);
  const st = useMemo(() => statsRayonnage(snapshot, index, id), [snapshot, index, id]);
  if (!r) return <p className="text-acier-400">Rayonnage introuvable : {id}</p>;
  const zone = layout.zones.find((z) => z.id === r.zone);
  const emps = snapshot.emplacements.filter((e) => e.Rayonnage === id);
  const niveaux = [...new Set(emps.map((e) => e.Niveau))].sort().reverse();
  const positions = [...new Set(emps.map((e) => e.Position))].sort();

  return (
    <div className="space-y-4" data-testid="panneau-rayonnage">
      <div>
        <div className="font-mono text-xl font-semibold text-white">{r.id}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-acier-300">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: zone?.couleur }} />
          {zone?.nom ?? `Zone ${r.zone}`}
        </div>
      </div>
      <div>
        <Ligne libelle="Zone" valeur={r.zone} />
        <Ligne libelle="Emplacements" valeur={`${st.nbEmplacements} (${st.nbEmplacementsOccupes} occupés)`} />
        <Ligne libelle="Références" valeur={nombre(st.nbReferences)} />
        <Ligne libelle="Quantités" valeur={nombre(st.quantiteTotale)} />
        <Ligne libelle="Capacité" valeur={nombre(st.capaciteTotale)} />
        <Ligne libelle="Taux d'occupation" valeur={pct(st.tauxOccupation)} />
        <div className="mt-2">
          <Jauge taux={st.tauxOccupation} />
        </div>
      </div>
      <div>
        <div className="titre-section mb-2">Plan de face</div>
        <div className="space-y-1">
          {niveaux.map((n) => (
            <div key={n} className="flex items-center gap-1">
              <span className="w-7 font-mono text-[10px] text-acier-500">{n}</span>
              {positions.map((p) => {
                const e = emps.find((x) => x.Niveau === n && x.Position === p);
                if (!e) return <span key={p} className="h-7 flex-1" />;
                const q = index.quantiteParEmplacement.get(e.EmplacementID) ?? 0;
                const t = tauxOccupation(index, e.EmplacementID);
                return (
                  <button
                    key={p}
                    onClick={() => selectionner({ type: 'emplacement', id: e.EmplacementID })}
                    className={`h-7 flex-1 rounded-sm text-[10px] font-semibold text-black/70 hover:brightness-125 ${surbrillance.includes(e.EmplacementID) ? 'ring-2 ring-securite' : ''}`}
                    style={{ background: couleurOccupation(t, q === 0) }}
                    title={`${e.EmplacementID} — ${q} unité(s)`}
                  >
                    {q > 0 ? q : ''}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex gap-1 pl-8">
            {positions.map((p) => (
              <span key={p} className="flex-1 text-center font-mono text-[10px] text-acier-500">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanneauEmplacement({ id }: { id: string }) {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const layout = useStore((s) => s.layout)!;
  const role = useStore((s) => s.role);
  const ouvrirFormulaire = useStore((s) => s.ouvrirFormulaire);
  const localiser = useStore((s) => s.localiser);
  const selectionner = useStore((s) => s.selectionner);
  const surbrillance = useStore((s) => s.surbrillance);
  const articleLocalise = useStore((s) => s.articleLocalise);
  const [articleChoisi, setArticleChoisi] = useState<string | null>(null);
  const [historique, setHistorique] = useState(false);

  const e = index.emplacementParId.get(id);
  const stocks = useMemo(
    () =>
      (index.stocksParEmplacement.get(id) ?? [])
        .slice()
        .sort((a, b) => (index.articleParId.get(a.ArticleID)?.Reference ?? '').localeCompare(index.articleParId.get(b.ArticleID)?.Reference ?? '')),
    [index, id],
  );
  const mvts = useMemo(
    () =>
      historique
        ? snapshot.mouvements
            .filter((m) => m.EmplacementSource === id || m.EmplacementDestination === id)
            .sort((a, b) => b.DateHeure.localeCompare(a.DateHeure))
            .slice(0, 40)
        : [],
    [historique, snapshot, id],
  );
  if (!e) return <p className="text-acier-400">Emplacement introuvable : {id}</p>;

  const zone = layout.zones.find((z) => z.id === e.Zone);
  const q = index.quantiteParEmplacement.get(id) ?? 0;
  const taux = tauxOccupation(index, id);
  const article = articleChoisi && stocks.some((s) => s.ArticleID === articleChoisi) ? articleChoisi : stocks[0]?.ArticleID;
  const ecriture = peut(role, 'mouvement');
  const ouvrir = (type: TypeMouvement) =>
    ouvrirFormulaire({ type, articleId: article, source: id, destination: id });
  const localise = articleLocalise ? index.articleParId.get(articleLocalise) : null;

  return (
    <div className="space-y-4" data-testid="panneau-emplacement">
      <div>
        <div className="font-mono text-lg font-semibold text-white" data-testid="emplacement-id">
          {e.EmplacementID}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-acier-300">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: zone?.couleur }} />
          {zone?.nom ?? `Zone ${e.Zone}`}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
          {[
            ['Rayonnage', e.Rayonnage],
            ['Niveau', e.Niveau],
            ['Position', e.Position],
          ].map(([l, v]) => (
            <button
              key={l}
              className="rounded bg-acier-800 py-1 hover:bg-acier-700"
              onClick={() => l === 'Rayonnage' && selectionner({ type: 'rayonnage', id: e.Rayonnage })}
              disabled={l !== 'Rayonnage'}
            >
              <div className="text-acier-500">{l}</div>
              <div className="font-mono font-semibold text-acier-100">{v}</div>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-acier-400">
          <span>
            {nombre(q)} / {nombre(e.Capacite)} unités
          </span>
          <span>{pct(taux)}</span>
        </div>
        <Jauge taux={taux} />
      </div>

      {localise && surbrillance.length > 0 && (
        <div className="rounded border border-securite/40 bg-securite/10 p-2" data-testid="localisation">
          <div className="text-[11px] text-securite">
            <span className="font-mono font-semibold">{localise.Reference}</span> présente à {surbrillance.length} emplacement{surbrillance.length > 1 ? 's' : ''} :
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {surbrillance.map((x) => (
              <button
                key={x}
                onClick={() => localiser(surbrillance, { focus: x, articleId: articleLocalise })}
                className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${x === id ? 'bg-securite text-acier-950' : 'bg-acier-800 text-acier-200 hover:bg-acier-700'}`}
              >
                {x} × {index.stocksParArticle.get(articleLocalise!)?.find((s) => s.EmplacementID === x)?.Quantite ?? 0}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="titre-section mb-1.5">Références ({stocks.length})</div>
        {stocks.length === 0 && <p className="text-xs text-acier-500">Emplacement vide.</p>}
        <ul className="space-y-1" data-testid="liste-references">
          {stocks.map((s) => {
            const a = index.articleParId.get(s.ArticleID);
            const autres = index.stocksParArticle.get(s.ArticleID) ?? [];
            return (
              <li
                key={s.StockID}
                className={`cursor-pointer rounded border px-2 py-1.5 ${article === s.ArticleID ? 'border-securite/60 bg-acier-800' : 'border-acier-700 hover:bg-acier-800'}`}
                onClick={() => setArticleChoisi(s.ArticleID)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-white">{a?.Reference ?? s.ArticleID}</span>
                  <span className="text-sm font-semibold text-acier-100">
                    {nombre(s.Quantite)} <span className="text-[10px] font-normal text-acier-400">{a?.Unite}</span>
                  </span>
                </div>
                <div className="truncate text-[11px] text-acier-400">{a?.Designation}</div>
                {autres.length > 1 && (
                  <button
                    className="mt-0.5 text-[10px] text-sky-300 hover:underline"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      localiser(autres.map((x) => x.EmplacementID), { focus: id, articleId: s.ArticleID });
                    }}
                  >
                    Aussi à {autres.length - 1} autre(s) emplacement(s) — localiser
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button className="btn-primaire" disabled={!ecriture} onClick={() => ouvrir('ENTREE')} data-testid="btn-entree">
          <Icone nom="entree" className="h-3.5 w-3.5" /> Entrée
        </button>
        <button className="btn-secondaire" disabled={!ecriture || !stocks.length} onClick={() => ouvrir('SORTIE')} data-testid="btn-sortie">
          <Icone nom="sortie" className="h-3.5 w-3.5" /> Sortie
        </button>
        <button className="btn-secondaire" disabled={!ecriture || !stocks.length} onClick={() => ouvrir('TRANSFERT')} data-testid="btn-transfert">
          <Icone nom="transfert" className="h-3.5 w-3.5" /> Transfert
        </button>
        <button className="btn-secondaire" disabled={!ecriture || !stocks.length} onClick={() => ouvrir('STANDBY_DEPART')} data-testid="btn-standby">
          <Icone nom="standby" className="h-3.5 w-3.5" /> Stand-by
        </button>
        <button className={`btn-secondaire col-span-2 ${historique ? 'ring-1 ring-securite' : ''}`} onClick={() => setHistorique((h) => !h)} data-testid="btn-historique">
          <Icone nom="historique" className="h-3.5 w-3.5" /> Historique
        </button>
      </div>
      {!ecriture && <p className="text-[11px] text-acier-500">Rôle Lecteur (simulé) : consultation seule.</p>}

      {historique && (
        <div data-testid="historique-emplacement">
          <div className="titre-section mb-1.5">Historique de l'emplacement</div>
          {mvts.length === 0 && <p className="text-xs text-acier-500">Aucun mouvement.</p>}
          <ul className="space-y-1">
            {mvts.map((m) => (
              <li key={m.MouvementID} className="rounded bg-acier-850 px-2 py-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="font-semibold text-acier-200">{LIBELLES_MOUVEMENT[m.Type]}</span>
                  <span className="text-acier-500">{dateHeure(m.DateHeure)}</span>
                </div>
                <div className="text-acier-400">
                  <span className="font-mono">{index.articleParId.get(m.ArticleID)?.Reference}</span> × {m.Type === 'AJUSTEMENT' ? `${m.Quantite} (écart ${m.Ecart})` : m.Quantite}
                  {m.EmplacementSource === id && m.EmplacementDestination ? ` → ${m.EmplacementDestination}` : ''}
                  {m.EmplacementDestination === id && m.EmplacementSource ? ` ← ${m.EmplacementSource}` : ''} · {m.Utilisateur}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
