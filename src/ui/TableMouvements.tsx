import { LIBELLES_MOUVEMENT, type Mouvement, type TypeMouvement } from '../domain/types';
import { useStore } from '../store/useStore';
import { dateHeure, nombre } from './format';

export const COULEUR_TYPE: Record<TypeMouvement, string> = {
  ENTREE: 'bg-emerald-900 text-emerald-200',
  SORTIE: 'bg-red-900 text-red-200',
  TRANSFERT: 'bg-sky-900 text-sky-200',
  STANDBY_DEPART: 'bg-amber-900 text-amber-200',
  STANDBY_RETOUR: 'bg-teal-900 text-teal-200',
  STANDBY_CONSOMME: 'bg-orange-900 text-orange-200',
  AJUSTEMENT: 'bg-violet-900 text-violet-200',
};

function Emp({ id }: { id: string | null }) {
  const localiser = useStore((s) => s.localiser);
  if (!id) return <span className="text-acier-600">—</span>;
  return (
    <button className="font-mono text-acier-200 hover:text-securite hover:underline" onClick={() => localiser([id])}>
      {id}
    </button>
  );
}

export function TableMouvements({ mouvements, compact = false }: { mouvements: Mouvement[]; compact?: boolean }) {
  const index = useStore((s) => s.index);
  return (
    <table className="table-std" data-testid="table-mouvements">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Référence</th>
          {!compact && <th>Désignation</th>}
          <th className="text-right">Qté</th>
          <th>Source</th>
          <th>Destination</th>
          <th>Utilisateur</th>
          {!compact && <th>Motif / chantier</th>}
        </tr>
      </thead>
      <tbody>
        {mouvements.map((m) => {
          const a = index.articleParId.get(m.ArticleID);
          return (
            <tr key={m.MouvementID}>
              <td className="whitespace-nowrap text-acier-400">{dateHeure(m.DateHeure)}</td>
              <td>
                <span className={`pastille ${COULEUR_TYPE[m.Type]}`}>{LIBELLES_MOUVEMENT[m.Type]}</span>
              </td>
              <td className="font-mono font-semibold text-white">{a?.Reference ?? m.ArticleID}</td>
              {!compact && <td className="max-w-[220px] truncate text-acier-300">{a?.Designation}</td>}
              <td className="text-right font-semibold">
                {m.Type === 'AJUSTEMENT' ? `${m.Ecart && m.Ecart > 0 ? '+' : ''}${m.Ecart}` : nombre(m.Quantite)}
              </td>
              <td>
                <Emp id={m.EmplacementSource} />
              </td>
              <td>
                {m.EmplacementDestination ? <Emp id={m.EmplacementDestination} /> : <span className="text-acier-400">{m.Destination || '—'}</span>}
              </td>
              <td className="text-acier-400">{m.Utilisateur}</td>
              {!compact && <td className="max-w-[200px] truncate text-acier-400">{[m.Motif, m.Destination].filter(Boolean).join(' · ')}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
