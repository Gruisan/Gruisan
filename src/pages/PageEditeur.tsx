import { useStore } from '../store/useStore';

export function PageEditeur() {
  const layout = useStore((s) => s.layout)!;
  return (
    <div className="h-full overflow-auto p-4" data-testid="page-editeur">
      <h1 className="mb-1 text-base font-semibold text-white">Éditeur de magasin</h1>
      <p className="mb-4 text-xs text-acier-400">Prévu en phase 4 (administrateur). La disposition actuelle provient de layout.json :</p>
      <div className="carte max-w-xl p-3 text-xs text-acier-300">
        <div>{layout.nom}</div>
        <div>
          Bâtiment {layout.batiment.longueur} × {layout.batiment.largeur} × {layout.batiment.hauteur} m · {layout.zones.length} zones · {layout.rayonnages.length} rayonnages ·{' '}
          {layout.rayonnages.reduce((n, r) => n + r.niveaux * r.emplacementsParNiveau, 0)} emplacements · {layout.aires.length} aires au sol · {layout.portes.length} porte(s)
        </div>
      </div>
    </div>
  );
}
