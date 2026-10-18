import { useStore } from '../store/useStore';
import { heure } from './format';

const COULEUR = { info: 'text-sky-300', succes: 'text-emerald-300', erreur: 'text-red-300' } as const;

export function BarreBasse() {
  const evenements = useStore((s) => s.evenements);
  return (
    <footer className="flex h-7 items-center gap-4 overflow-hidden border-t border-acier-800 bg-acier-900 px-3 text-[11px]" data-testid="barre-evenements">
      <span className="shrink-0 font-semibold uppercase tracking-wider text-acier-500">Événements</span>
      <div className="flex min-w-0 flex-1 gap-5 overflow-hidden whitespace-nowrap">
        {evenements.length === 0 && <span className="text-acier-500">Aucun événement pour cette session.</span>}
        {evenements.slice(0, 6).map((e, i) => (
          <span key={e.id} className={`${COULEUR[e.niveau]} ${i > 0 ? 'opacity-60' : ''}`}>
            <span className="text-acier-500">{heure(e.date)}</span> {e.texte}
          </span>
        ))}
      </div>
    </footer>
  );
}
