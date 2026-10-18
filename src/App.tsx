import { useEffect } from 'react';
import { BarreBasse } from './ui/BarreBasse';
import { BarreHaute } from './ui/BarreHaute';
import { FormulaireMouvement } from './ui/FormulaireMouvement';
import { MenuGauche } from './ui/MenuGauche';
import { PanneauDroit } from './ui/PanneauDroit';
import { PageAlertes } from './pages/PageAlertes';
import { PageEditeur } from './pages/PageEditeur';
import { PageHistorique } from './pages/PageHistorique';
import { PageInventaire } from './pages/PageInventaire';
import { PageMagasin } from './pages/PageMagasin';
import { PageMouvements } from './pages/PageMouvements';
import { PageParametres } from './pages/PageParametres';
import { PageStandby } from './pages/PageStandby';
import { PageTableauDeBord } from './pages/PageTableauDeBord';
import { useStore } from './store/useStore';

export default function App() {
  const pret = useStore((s) => s.pret);
  const erreurInit = useStore((s) => s.erreurInit);
  const page = useStore((s) => s.page);
  const selection = useStore((s) => s.selection);
  const formulaire = useStore((s) => s.formulaire);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useStore.getState().formulaire) {
        useStore.getState().selectionner(null);
        useStore.getState().effacerSurbrillance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!pret) {
    return <div className="flex h-full items-center justify-center text-acier-300">Chargement des données…</div>;
  }
  if (erreurInit) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="carte max-w-lg p-6">
          <h1 className="mb-2 text-lg font-semibold text-red-400">Impossible de charger les données</h1>
          <p className="text-acier-300">{erreurInit}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[176px_1fr_auto] grid-rows-[48px_1fr_28px] bg-acier-950">
      <div className="col-span-3">
        <BarreHaute />
      </div>
      <MenuGauche />
      <main className="relative min-w-0 overflow-hidden border-x border-acier-800">
        {page === 'tableau' && <PageTableauDeBord />}
        <PageMagasin actif={page === 'magasin'} />
        {page === 'inventaire' && <PageInventaire />}
        {page === 'mouvements' && <PageMouvements />}
        {page === 'standby' && <PageStandby />}
        {page === 'historique' && <PageHistorique />}
        {page === 'alertes' && <PageAlertes />}
        {page === 'editeur' && <PageEditeur />}
        {page === 'parametres' && <PageParametres />}
      </main>
      <aside className={selection ? 'w-[300px] overflow-hidden xl:w-[340px]' : 'w-0'}>{selection && <PanneauDroit />}</aside>
      <div className="col-span-3">
        <BarreBasse />
      </div>
      {formulaire && <FormulaireMouvement />}
    </div>
  );
}
