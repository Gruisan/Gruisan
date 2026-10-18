import { useMemo, useRef, useState } from 'react';
import { quantiteA, quantiteStandbyRestante } from '../domain/engine';
import { rechercher } from '../domain/indexes';
import { LIBELLES_MOUVEMENT, type MouvementInput, type TypeMouvement } from '../domain/types';
import { uuidv4 } from '../domain/uuid';
import { useStore } from '../store/useStore';
import { nombre } from './format';
import { Icone } from './Icone';

const ONGLETS: TypeMouvement[] = ['ENTREE', 'SORTIE', 'TRANSFERT', 'STANDBY_DEPART', 'AJUSTEMENT'];
const MOTIFS: Partial<Record<TypeMouvement, string[]>> = {
  ENTREE: ['Réception commande', 'Retour atelier', 'Réparation revenue', 'Inventaire'],
  SORTIE: ['Dépannage', 'Maintenance préventive', 'Travaux neufs', 'Rebut', 'Prêt'],
  TRANSFERT: ['Réorganisation', 'Regroupement', 'Emplacement saturé'],
  STANDBY_DEPART: ['Au cas où', 'Intervention planifiée'],
  STANDBY_RETOUR: ['Non utilisé', 'Fin de chantier'],
  STANDBY_CONSOMME: ['Utilisé sur chantier'],
  AJUSTEMENT: ['Inventaire tournant', 'Écart constaté', 'Casse'],
};

export function FormulaireMouvement() {
  const f = useStore((s) => s.formulaire)!;
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const utilisateur = useStore((s) => s.utilisateur);
  const appliquer = useStore((s) => s.appliquer);
  const fermer = () => useStore.getState().ouvrirFormulaire(null);

  // UUID fixé à l'ouverture : un double clic sur « Valider » ne crée pas de doublon.
  const mouvementId = useRef(uuidv4());
  const standby = f.standbyId ? snapshot.standbys.find((x) => x.StandbyID === f.standbyId) : undefined;
  const [type, setType] = useState<TypeMouvement>(f.type);
  const [articleId, setArticleId] = useState<string | undefined>(standby?.ArticleID ?? f.articleId);
  const [source, setSource] = useState<string | undefined>(f.source);
  const [destination, setDestination] = useState<string | undefined>(f.destination ?? standby?.EmplacementOrigine);
  const [quantite, setQuantite] = useState<string>(standby ? String(quantiteStandbyRestante(standby)) : '');
  const [motif, setMotif] = useState('');
  const [destinationTexte, setDestinationTexte] = useState('');
  const [chantier, setChantier] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const article = articleId ? index.articleParId.get(articleId) : undefined;
  const stocksArticle = articleId ? index.stocksParArticle.get(articleId) ?? [] : [];
  const besoinSource = type === 'SORTIE' || type === 'TRANSFERT' || type === 'STANDBY_DEPART';
  const besoinDest = type === 'ENTREE' || type === 'TRANSFERT' || type === 'STANDBY_RETOUR' || type === 'AJUSTEMENT';
  const sourceEffective = besoinSource ? (source && stocksArticle.some((s) => s.EmplacementID === source) ? source : stocksArticle[0]?.EmplacementID) : undefined;
  const dispoSource = articleId && sourceEffective ? quantiteA(snapshot, articleId, sourceEffective) : 0;
  const empAjust = type === 'AJUSTEMENT' ? destination ?? f.source : undefined;
  const destEffective = type === 'TRANSFERT' && destination === sourceEffective ? undefined : destination;
  const q = Number(quantite);
  const estStandbyAction = type === 'STANDBY_RETOUR' || type === 'STANDBY_CONSOMME';

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleId) return setErreur('Choisissez une référence.');
    const input: MouvementInput = {
      MouvementID: mouvementId.current,
      Type: type,
      ArticleID: articleId,
      EmplacementSource: besoinSource ? sourceEffective ?? null : null,
      EmplacementDestination: type === 'AJUSTEMENT' ? empAjust ?? null : besoinDest ? destEffective ?? null : null,
      Quantite: q,
      Utilisateur: utilisateur,
      Motif: motif,
      Destination: destinationTexte,
      Commentaire: commentaire,
      Chantier: chantier,
      StandbyID: standby?.StandbyID,
    };
    setEnvoi(true);
    const r = await appliquer(input);
    setEnvoi(false);
    if (r.ok) fermer();
    else setErreur(r.error);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <form
        onSubmit={valider}
        onKeyDown={(e) => e.key === 'Escape' && fermer()}
        className="carte flex max-h-full w-full max-w-lg flex-col bg-acier-900 shadow-2xl"
        data-testid="formulaire-mouvement"
      >
        <div className="flex items-center justify-between border-b border-acier-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white">{estStandbyAction ? LIBELLES_MOUVEMENT[type] : 'Nouveau mouvement'}</h2>
          <button type="button" className="btn-fantome px-1.5" onClick={fermer} aria-label="Fermer">
            <Icone nom="fermer" />
          </button>
        </div>
        {!estStandbyAction && (
          <div className="flex gap-1 border-b border-acier-800 px-3 pt-2">
            {ONGLETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setErreur(null);
                  setMotif('');
                }}
                className={`rounded-t px-2.5 py-1.5 text-xs ${type === t ? 'bg-acier-700 font-semibold text-white' : 'text-acier-400 hover:text-acier-100'}`}
                data-testid={`onglet-${t}`}
              >
                {LIBELLES_MOUVEMENT[t]}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3 overflow-auto p-4">
          {standby ? (
            <div className="rounded bg-acier-800 p-2 text-xs text-acier-300">
              <div>
                <span className="font-mono font-semibold text-white">{article?.Reference}</span> — {article?.Designation}
              </div>
              <div>
                Chantier : <b className="text-acier-100">{standby.Chantier}</b> · origine <span className="font-mono">{standby.EmplacementOrigine}</span> · reste en stand-by :{' '}
                <b className="text-acier-100">{quantiteStandbyRestante(standby)}</b>
              </div>
            </div>
          ) : (
            <SelecteurArticle articleId={articleId} onChange={(id) => (setArticleId(id), setSource(undefined))} />
          )}

          {besoinSource && (
            <div>
              <label className="etiquette">Emplacement source</label>
              {stocksArticle.length === 0 ? (
                <p className="text-xs text-red-300">{article ? 'Cette référence n’est stockée dans aucun emplacement.' : 'Choisissez d’abord une référence.'}</p>
              ) : (
                <select className="champ font-mono" value={sourceEffective} onChange={(e) => setSource(e.target.value)} data-testid="champ-source">
                  {stocksArticle.map((s) => (
                    <option key={s.EmplacementID} value={s.EmplacementID}>
                      {s.EmplacementID} — {s.Quantite} disponible(s)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {besoinDest && (
            <div>
              <label className="etiquette">{type === 'AJUSTEMENT' ? 'Emplacement inventorié' : type === 'STANDBY_RETOUR' ? 'Emplacement de retour' : 'Emplacement de destination'}</label>
              <SelecteurEmplacement
                valeur={type === 'AJUSTEMENT' ? empAjust : destEffective}
                onChange={setDestination}
                articleId={articleId}
                exclure={type === 'TRANSFERT' ? sourceEffective : undefined}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiquette">{type === 'AJUSTEMENT' ? 'Quantité comptée' : 'Quantité'}</label>
              <input
                className="champ"
                type="number"
                min={type === 'AJUSTEMENT' ? 0 : 1}
                step={1}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                required
                autoFocus={!!articleId}
                data-testid="champ-quantite"
              />
              <div className="mt-1 text-[11px] text-acier-400">
                {besoinSource && sourceEffective && `Disponible à ${sourceEffective} : ${nombre(dispoSource)} ${article?.Unite ?? ''}`}
                {type === 'AJUSTEMENT' && articleId && empAjust && `Enregistré : ${quantiteA(snapshot, articleId, empAjust)}`}
                {standby && `Maximum : ${quantiteStandbyRestante(standby)}`}
              </div>
            </div>
            <div>
              <label className="etiquette">Motif</label>
              <input className="champ" list={`motifs-${type}`} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="—" />
              <datalist id={`motifs-${type}`}>
                {(MOTIFS[type] ?? []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          {type === 'STANDBY_DEPART' && (
            <div>
              <label className="etiquette">Chantier *</label>
              <input className="champ" value={chantier} onChange={(e) => setChantier(e.target.value)} required placeholder="Nom du chantier" data-testid="champ-chantier" />
            </div>
          )}
          {type === 'SORTIE' && (
            <div>
              <label className="etiquette">Destination</label>
              <input className="champ" value={destinationTexte} onChange={(e) => setDestinationTexte(e.target.value)} placeholder="Chantier, atelier, poste…" />
            </div>
          )}
          <div>
            <label className="etiquette">Commentaire</label>
            <textarea className="champ h-14 resize-none" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>
          <div className="text-[11px] text-acier-500">
            Utilisateur : <span className="text-acier-300">{utilisateur}</span> · ID <span className="font-mono">{mouvementId.current.slice(0, 8)}…</span>
          </div>
          {erreur && (
            <div className="rounded border border-red-800 bg-red-950/60 p-2 text-xs text-red-200" role="alert" data-testid="erreur-mouvement">
              {erreur}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-acier-700 px-4 py-2.5">
          <button type="button" className="btn-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="submit" className="btn-primaire" disabled={envoi} data-testid="btn-valider">
            Valider
          </button>
        </div>
      </form>
    </div>
  );
}

function SelecteurArticle({ articleId, onChange }: { articleId?: string; onChange: (id: string) => void }) {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(!articleId);
  const a = articleId ? index.articleParId.get(articleId) : undefined;
  const res = useMemo(
    () => (q.trim() ? rechercher(snapshot, index, q, 40).filter((r) => r.type === 'article') : snapshot.articles.slice(0, 40).map((x) => ({ id: x.ArticleID }))),
    [q, snapshot, index],
  );
  return (
    <div className="relative">
      <label className="etiquette">Référence</label>
      {a && !ouvert ? (
        <button type="button" className="champ flex items-center justify-between text-left" onClick={() => setOuvert(true)} data-testid="article-choisi">
          <span>
            <span className="font-mono font-semibold">{a.Reference}</span> <span className="text-acier-400">— {a.Designation}</span>
          </span>
          <span className="text-[11px] text-acier-400">changer</span>
        </button>
      ) : (
        <>
          <input className="champ" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une référence…" data-testid="champ-article" />
          <div className="mt-1 max-h-44 overflow-auto rounded border border-acier-700">
            {res.map((r) => {
              const x = index.articleParId.get(r.id)!;
              return (
                <button
                  type="button"
                  key={r.id}
                  className="flex w-full justify-between gap-2 border-b border-acier-800 px-2 py-1 text-left text-xs hover:bg-acier-700"
                  onClick={() => {
                    onChange(r.id);
                    setOuvert(false);
                  }}
                >
                  <span className="truncate">
                    <span className="font-mono font-semibold text-white">{x.Reference}</span> <span className="text-acier-400">{x.Designation}</span>
                  </span>
                  <span className="shrink-0 text-acier-400">{index.disponibleParArticle.get(x.ArticleID) ?? 0}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SelecteurEmplacement({ valeur, onChange, articleId, exclure }: { valeur?: string; onChange: (v: string) => void; articleId?: string; exclure?: string }) {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const groupes = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of snapshot.emplacements) {
      const l = m.get(e.Rayonnage) ?? [];
      l.push(e.EmplacementID);
      m.set(e.Rayonnage, l);
    }
    return [...m];
  }, [snapshot.emplacements]);
  return (
    <select className="champ font-mono" value={valeur ?? ''} onChange={(e) => onChange(e.target.value)} required data-testid="champ-destination">
      <option value="" disabled>
        — choisir —
      </option>
      {groupes.map(([r, ids]) => (
        <optgroup key={r} label={`Rayonnage ${r}`}>
          {ids
            .filter((id) => id !== exclure)
            .map((id) => {
              const total = index.quantiteParEmplacement.get(id) ?? 0;
              const ici = articleId ? quantiteA(snapshot, articleId, id) : 0;
              const cap = index.emplacementParId.get(id)?.Capacite ?? 0;
              return (
                <option key={id} value={id}>
                  {id} {ici > 0 ? `· contient déjà ${ici}` : total === 0 ? '· vide' : `· ${total}/${cap}`}
                </option>
              );
            })}
        </optgroup>
      ))}
    </select>
  );
}
