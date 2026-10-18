import { useMemo } from 'react';
import { derniersMouvements } from '../domain/indexes';
import { peut } from '../domain/roles';
import { LIBELLES_MOUVEMENT, type TypeMouvement } from '../domain/types';
import { useStore } from '../store/useStore';
import { Icone } from '../ui/Icone';
import { TableMouvements } from '../ui/TableMouvements';

const ACTIONS: { type: TypeMouvement; icone: string; aide: string }[] = [
  { type: 'ENTREE', icone: 'entree', aide: 'Réception de matériel dans un emplacement' },
  { type: 'SORTIE', icone: 'sortie', aide: 'Sortie définitive depuis un emplacement' },
  { type: 'TRANSFERT', icone: 'transfert', aide: 'Déplacement entre deux emplacements (tout ou rien)' },
  { type: 'STANDBY_DEPART', icone: 'standby', aide: 'Départ en chantier « au cas où » — reste compté dans le total' },
  { type: 'AJUSTEMENT', icone: 'inventaire', aide: 'Correction après comptage' },
];

export function PageMouvements() {
  const snapshot = useStore((s) => s.snapshot);
  const role = useStore((s) => s.role);
  const ouvrirFormulaire = useStore((s) => s.ouvrirFormulaire);
  const derniers = useMemo(() => derniersMouvements(snapshot, 50), [snapshot]);
  const ecriture = peut(role, 'mouvement');
  return (
    <div className="flex h-full flex-col p-4" data-testid="page-mouvements">
      <h1 className="mb-3 text-base font-semibold text-white">Mouvements</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {ACTIONS.map((a) => (
          <button key={a.type} disabled={!ecriture} onClick={() => ouvrirFormulaire({ type: a.type })} className="carte p-3 text-left transition-colors enabled:hover:border-securite disabled:opacity-40" data-testid={`nouveau-${a.type}`}>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Icone nom={a.icone} /> {LIBELLES_MOUVEMENT[a.type]}
            </div>
            <div className="mt-1 text-[11px] text-acier-400">{a.aide}</div>
          </button>
        ))}
      </div>
      {!ecriture && <p className="mb-2 text-xs text-acier-400">Rôle Lecteur (simulé) : création de mouvements désactivée.</p>}
      <section className="carte min-h-0 flex-1 overflow-auto">
        <div className="border-b border-acier-700 px-3 py-2">
          <h2 className="titre-section">50 derniers mouvements</h2>
        </div>
        <TableMouvements mouvements={derniers} />
      </section>
    </div>
  );
}
