import Scene3D from '../scene/Scene3D';
import { useStore, type VueCamera } from '../store/useStore';
import { LEGENDE_OCCUPATION } from '../ui/format';
import { Icone } from '../ui/Icone';

const VUES: { id: VueCamera; libelle: string }[] = [
  { id: 'orbite', libelle: 'Orbitale' },
  { id: 'dessus', libelle: 'Dessus' },
  { id: 'iso', libelle: 'Isométrique' },
];

export function PageMagasin({ actif }: { actif: boolean }) {
  const layout = useStore((s) => s.layout)!;
  const setVue = useStore((s) => s.setVue);
  const vue = useStore((s) => s.vue);
  const surbrillance = useStore((s) => s.surbrillance);
  const articleLocalise = useStore((s) => s.articleLocalise);
  const article = useStore((s) => (articleLocalise ? s.index.articleParId.get(articleLocalise) : undefined));
  const effacer = useStore((s) => s.effacerSurbrillance);
  return (
    <div className={actif ? 'absolute inset-0' : 'hidden'} data-testid="page-magasin">
      <Scene3D layout={layout} actif={actif} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
        <div className="pointer-events-auto flex gap-1 rounded-md border border-acier-700 bg-acier-900/90 p-1">
          {VUES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVue(v.id)}
              className={`rounded px-2.5 py-1 text-xs ${vue.mode === v.id ? 'bg-acier-600 text-white' : 'text-acier-300 hover:bg-acier-800'}`}
              data-testid={`vue-${v.id}`}
            >
              {v.libelle}
            </button>
          ))}
        </div>
        {surbrillance.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-securite/50 bg-acier-900/90 px-2.5 py-1 text-xs text-securite">
            <Icone nom="cible" className="h-3.5 w-3.5" />
            {article ? (
              <span>
                <b className="font-mono">{article.Reference}</b> : {surbrillance.length} emplacement{surbrillance.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span>{surbrillance.length} emplacement(s) en surbrillance</span>
            )}
            <button className="text-acier-400 hover:text-white" onClick={effacer} aria-label="Effacer la surbrillance">
              <Icone nom="fermer" className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-md border border-acier-700 bg-acier-900/90 px-2.5 py-1.5 text-[11px] text-acier-300">
          <span className="text-acier-500">Occupation</span>
          {LEGENDE_OCCUPATION.map((l) => (
            <span key={l.libelle} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.couleur }} />
              {l.libelle}
            </span>
          ))}
        </div>
        <div className="text-[10px] text-acier-500">Clic gauche : sélectionner / tourner · clic droit : déplacer · molette : zoom · Échap : désélectionner</div>
      </div>
    </div>
  );
}
