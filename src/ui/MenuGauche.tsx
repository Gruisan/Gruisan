import { useStore, type Page } from '../store/useStore';
import { Icone } from './Icone';

const ENTREES: { page: Page; libelle: string; phase?: number }[] = [
  { page: 'tableau', libelle: 'Tableau de bord' },
  { page: 'magasin', libelle: 'Magasin 3D' },
  { page: 'inventaire', libelle: 'Inventaire' },
  { page: 'mouvements', libelle: 'Mouvements' },
  { page: 'standby', libelle: 'Stand-by' },
  { page: 'historique', libelle: 'Historique' },
  { page: 'alertes', libelle: 'Alertes' },
  { page: 'editeur', libelle: 'Éditeur', phase: 4 },
  { page: 'parametres', libelle: 'Paramètres' },
];

export function MenuGauche() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const nbStandby = useStore((s) => s.snapshot.standbys.filter((x) => x.Statut === 'ouvert').length);
  return (
    <nav className="flex flex-col gap-0.5 bg-acier-900 p-2" aria-label="Menu principal">
      {ENTREES.map((e) => (
        <button
          key={e.page}
          onClick={() => setPage(e.page)}
          className={`flex items-center gap-2.5 rounded px-2.5 py-2 text-left text-[13px] transition-colors ${
            page === e.page ? 'bg-acier-700 text-white shadow-[inset_3px_0_0_#f5b301]' : 'text-acier-300 hover:bg-acier-800 hover:text-acier-100'
          }`}
        >
          <Icone nom={e.page} />
          <span className="flex-1">{e.libelle}</span>
          {e.page === 'standby' && nbStandby > 0 && <span className="rounded bg-acier-600 px-1.5 text-[10px]">{nbStandby}</span>}
          {e.phase && <span className="text-[9px] text-acier-500">P{e.phase}</span>}
        </button>
      ))}
      <div className="mt-auto px-2 pb-1 text-[10px] leading-tight text-acier-500">
        Données fictives de démonstration.
      </div>
    </nav>
  );
}
