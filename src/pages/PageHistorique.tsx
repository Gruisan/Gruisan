import { useMemo, useState } from 'react';
import { LIBELLES_MOUVEMENT, TYPES_MOUVEMENT, type TypeMouvement } from '../domain/types';
import { useStore } from '../store/useStore';
import { nombre } from '../ui/format';
import { TableMouvements } from '../ui/TableMouvements';

const PAR_PAGE = 50;

// Version phase 1 : filtres simples + pagination. Les graphiques mensuels arrivent en phase 3.
export function PageHistorique() {
  const snapshot = useStore((s) => s.snapshot);
  const index = useStore((s) => s.index);
  const [type, setType] = useState<TypeMouvement | ''>('');
  const [texte, setTexte] = useState('');
  const [page, setPage] = useState(0);
  const lignes = useMemo(() => {
    const t = texte.trim().toLowerCase();
    return snapshot.mouvements
      .filter((m) => {
        if (type && m.Type !== type) return false;
        if (!t) return true;
        const a = index.articleParId.get(m.ArticleID);
        return [a?.Reference, a?.Designation, m.EmplacementSource, m.EmplacementDestination, m.Utilisateur, m.Motif, m.Destination]
          .filter(Boolean)
          .some((x) => x!.toLowerCase().includes(t));
      })
      .sort((a, b) => b.DateHeure.localeCompare(a.DateHeure));
  }, [snapshot.mouvements, index, type, texte]);
  const nbPages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  const p = Math.min(page, nbPages - 1);
  return (
    <div className="flex h-full flex-col p-4" data-testid="page-historique">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-3 text-base font-semibold text-white">Historique</h1>
        <input className="champ w-64" placeholder="Référence, emplacement, utilisateur…" value={texte} onChange={(e) => (setTexte(e.target.value), setPage(0))} />
        <select className="champ w-48" value={type} onChange={(e) => (setType(e.target.value as TypeMouvement | ''), setPage(0))}>
          <option value="">Tous types</option>
          {TYPES_MOUVEMENT.map((t) => (
            <option key={t} value={t}>
              {LIBELLES_MOUVEMENT[t]}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-acier-400">{nombre(lignes.length)} mouvement(s)</span>
      </div>
      <div className="carte min-h-0 flex-1 overflow-auto">
        <TableMouvements mouvements={lignes.slice(p * PAR_PAGE, (p + 1) * PAR_PAGE)} />
      </div>
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
    </div>
  );
}
