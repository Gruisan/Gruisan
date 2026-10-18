import { useEffect, useMemo, useRef, useState } from 'react';
import { rechercher, type ResultatRecherche } from '../domain/indexes';
import { useStore, type Role } from '../store/useStore';
import { heure, nombre } from './format';
import { Icone, Logo } from './Icone';

const ROLES: { id: Role; libelle: string }[] = [
  { id: 'lecteur', libelle: 'Lecteur' },
  { id: 'magasinier', libelle: 'Magasinier' },
  { id: 'administrateur', libelle: 'Administrateur' },
];

export function BarreHaute() {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const statut = useStore((s) => s.statut);
  return (
    <header className="flex h-12 items-center gap-4 border-b border-acier-800 bg-acier-900 px-3">
      <div className="flex w-[160px] shrink-0 items-center gap-2">
        <Logo />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white">Magasin 3D</div>
          <div className="text-[10px] uppercase tracking-wider text-acier-400">Digital Stock</div>
        </div>
      </div>
      <Recherche />
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-acier-300" title="Simulation — aucune sécurité réelle">
          <span className="hidden text-acier-400 lg:inline">Rôle simulé</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="champ w-auto py-1 text-xs" aria-label="Rôle simulé">
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.libelle}
              </option>
            ))}
          </select>
          <span className="pastille bg-acier-700 text-acier-300">simulation</span>
        </label>
        <EtatDonnees statut={statut} />
      </div>
    </header>
  );
}

function EtatDonnees({ statut }: { statut: ReturnType<typeof useStore.getState>['statut'] }) {
  if (!statut) return null;
  const libelle = { indexeddb: 'IndexedDB', localstorage: 'localStorage', memoire: 'Mémoire seule', distant: 'Distant' }[statut.persistance];
  const ok = statut.durable && !statut.erreur?.startsWith('Échec');
  return (
    <div
      className={`flex items-center gap-2 rounded border px-2 py-1 text-[11px] ${ok ? 'border-emerald-800 text-emerald-300' : 'border-red-800 text-red-300'}`}
      title={[`Source : ${statut.source}`, `Persistance : ${libelle}`, statut.erreur ?? ''].filter(Boolean).join('\n')}
      data-testid="etat-donnees"
    >
      <Icone nom="base" className="h-3.5 w-3.5" />
      <span>
        {statut.source} · {libelle}
      </span>
      {statut.derniereSauvegarde && <span className="text-acier-400">enreg. {heure(statut.derniereSauvegarde)}</span>}
    </div>
  );
}

function Recherche() {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const localiser = useStore((s) => s.localiser);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const resultats = useMemo(() => rechercher(snapshot, index, q), [snapshot, index, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setActif(0), [q]);

  const choisir = (r: ResultatRecherche, emplacement?: string) => {
    const emps = r.emplacements.map((e) => e.id);
    if (emps.length === 0) {
      useStore.getState().notifier('info', `${r.libelle} : aucune quantité en emplacement (rupture).`);
      useStore.getState().setPage('inventaire');
    } else {
      localiser(emps, { focus: emplacement ?? emps[0], articleId: r.type === 'article' ? r.id : null });
    }
    setOuvert(false);
    ref.current?.blur();
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded border border-acier-600 bg-acier-950 px-2 focus-within:border-securite">
        <Icone nom="recherche" className="h-4 w-4 text-acier-400" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActif((a) => Math.min(a + 1, resultats.length - 1));
            else if (e.key === 'ArrowUp') setActif((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && resultats[actif]) choisir(resultats[actif]);
            else if (e.key === 'Escape') {
              setQ('');
              ref.current?.blur();
            }
          }}
          placeholder="Rechercher une référence, désignation, catégorie, constructeur, emplacement…  (Ctrl+K)"
          className="h-8 w-full bg-transparent text-sm text-acier-100 placeholder:text-acier-500 focus:outline-none"
          aria-label="Recherche globale"
          data-testid="recherche"
        />
        {q && (
          <button className="text-acier-400 hover:text-white" onClick={() => setQ('')} aria-label="Effacer">
            <Icone nom="fermer" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {ouvert && q.trim() && (
        <div className="absolute left-0 right-0 top-10 z-50 max-h-[70vh] overflow-auto rounded-md border border-acier-600 bg-acier-850 shadow-2xl" data-testid="resultats">
          {resultats.length === 0 && <div className="p-3 text-acier-400">Aucun résultat.</div>}
          {resultats.map((r, i) => (
            <div key={r.type + r.id} className={`border-b border-acier-800 px-3 py-2 ${i === actif ? 'bg-acier-700/60' : ''}`} onMouseEnter={() => setActif(i)}>
              <button className="block w-full text-left" onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(r)}>
                <div className="flex items-center gap-2">
                  <span className={`pastille ${r.type === 'article' ? 'bg-sky-900 text-sky-200' : 'bg-acier-600 text-acier-200'}`}>
                    {r.type === 'article' ? 'Réf.' : 'Empl.'}
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-white">{r.libelle}</span>
                  {r.type === 'article' && (
                    <span className="ml-auto text-[11px] text-acier-400">
                      {r.emplacements.length === 0 ? 'aucun emplacement' : `${r.emplacements.length} emplacement${r.emplacements.length > 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-acier-400">{r.detail}</div>
              </button>
              {r.type === 'article' && r.emplacements.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.emplacements.map((e) => (
                    <button
                      key={e.id}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => choisir(r, e.id)}
                      className="rounded border border-acier-600 bg-acier-900 px-1.5 py-0.5 font-mono text-[11px] text-acier-200 hover:border-securite hover:text-white"
                      data-testid="resultat-emplacement"
                    >
                      {e.id} <span className="text-acier-400">× {nombre(e.quantite)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
