// Emplacements cliquables (un seul InstancedMesh), colorés selon l'occupation,
// plus les repères de surbrillance (résultats de recherche, sélection).
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { tauxOccupation } from '../domain/indexes';
import { tousLesSlots, type Layout, type SlotGeometry } from '../domain/layout';
import { useStore } from '../store/useStore';
import { couleurOccupation, nombre, pct } from '../ui/format';

export function Emplacements({ layout }: { layout: Layout }) {
  const slots = useMemo(() => tousLesSlots(layout), [layout]);
  const index = useStore((s) => s.index);
  const selectionner = useStore((s) => s.selectionner);
  const ref = useRef<THREE.InstancedMesh>(null);
  const [survol, setSurvol] = useState<number | null>(null);

  useLayoutEffect(() => {
    const m = ref.current!;
    const o = new THREE.Object3D();
    slots.forEach((s, i) => {
      o.position.set(...s.centre);
      o.rotation.set(0, s.rotationY, 0);
      o.scale.set(...s.taille);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [slots]);

  useLayoutEffect(() => {
    const m = ref.current!;
    const c = new THREE.Color();
    slots.forEach((s, i) => {
      const q = index.quantiteParEmplacement.get(s.emplacementId) ?? 0;
      c.set(couleurOccupation(tauxOccupation(index, s.emplacementId), q === 0));
      if (i === survol) c.offsetHSL(0, 0, 0.18);
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [slots, index, survol]);

  const s = survol !== null ? slots[survol] : null;
  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, slots.length]}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && e.instanceId !== survol) setSurvol(e.instanceId);
        }}
        onPointerOut={() => setSurvol(null)}
        onClick={(e) => {
          if (e.delta > 5 || e.instanceId === undefined) return;
          e.stopPropagation();
          selectionner({ type: 'emplacement', id: slots[e.instanceId].emplacementId });
        }}
      >
        <boxGeometry />
        <meshLambertMaterial />
      </instancedMesh>
      {s && <InfoBulle slot={s} />}
      <Reperes slots={slots} />
    </group>
  );
}

function InfoBulle({ slot }: { slot: SlotGeometry }) {
  const index = useStore((s) => s.index);
  const stocks = index.stocksParEmplacement.get(slot.emplacementId) ?? [];
  const q = index.quantiteParEmplacement.get(slot.emplacementId) ?? 0;
  return (
    <Html position={[slot.centre[0], slot.centre[1] + slot.taille[1] / 2 + 0.05, slot.centre[2]]} center style={{ pointerEvents: 'none' }} zIndexRange={[40, 0]}>
      <div className="-translate-y-6 whitespace-nowrap rounded border border-acier-600 bg-acier-900/95 px-2 py-1 text-[11px] text-acier-200 shadow-lg">
        <div className="font-mono font-semibold text-white">{slot.emplacementId}</div>
        <div>
          {stocks.length === 0
            ? 'Vide'
            : `${stocks.length} réf. · ${nombre(q)} u. · ${pct(tauxOccupation(index, slot.emplacementId))}`}
        </div>
        {stocks.slice(0, 3).map((x) => (
          <div key={x.StockID} className="text-acier-400">
            <span className="font-mono">{index.articleParId.get(x.ArticleID)?.Reference}</span> × {x.Quantite}
          </div>
        ))}
      </div>
    </Html>
  );
}

/** Cadres lumineux sur les emplacements en surbrillance + balise au-dessus du rayonnage. */
function Reperes({ slots }: { slots: SlotGeometry[] }) {
  const surbrillance = useStore((s) => s.surbrillance);
  const selection = useStore((s) => s.selection);
  const layout = useStore((s) => s.layout)!;
  const ids = useMemo(() => {
    const set = new Set(surbrillance);
    if (selection?.type === 'emplacement') set.add(selection.id);
    return [...set];
  }, [surbrillance, selection]);
  const parId = useMemo(() => new Map(slots.map((s) => [s.emplacementId, s])), [slots]);
  const groupe = useRef<THREE.Group>(null);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  useFrame(({ clock }) => {
    const g = groupe.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.children.forEach((c) => {
      if (c.userData.balise) c.position.y = c.userData.y0 + Math.sin(t * 3) * 0.08;
      if (c.userData.cadre) {
        const k = 1.08 + Math.sin(t * 4) * 0.04;
        c.scale.set(c.userData.taille[0] * k, c.userData.taille[1] * k, c.userData.taille[2] * k);
      }
    });
  });
  return (
    <group ref={groupe}>
      {ids.map((id) => {
        const s = parId.get(id);
        if (!s) return null;
        const actif = selection?.type === 'emplacement' && selection.id === id;
        const couleur = actif ? '#ffffff' : '#f5b301';
        const r = layout.rayonnages.find((x) => x.id === s.rayonnageId);
        const yBalise = (r?.hauteur ?? 3) + 0.75;
        return [
          <lineSegments key={id + 'c'} geometry={edges} position={s.centre} rotation-y={s.rotationY} userData={{ cadre: true, taille: s.taille }} renderOrder={5}>
            <lineBasicMaterial color={couleur} depthTest={false} transparent />
          </lineSegments>,
          <group key={id + 'b'} position={[s.centre[0] + s.normale[0] * 0.2, yBalise, s.centre[2] + s.normale[2] * 0.2]} userData={{ balise: true, y0: yBalise }}>
            <mesh rotation-x={Math.PI}>
              <coneGeometry args={[0.14, 0.38, 16]} />
              <meshBasicMaterial color={couleur} />
            </mesh>
            <mesh position={[0, -(yBalise - s.centre[1]) / 2 - 0.2, 0]}>
              <cylinderGeometry args={[0.012, 0.012, yBalise - s.centre[1] - 0.4, 6]} />
              <meshBasicMaterial color={couleur} transparent opacity={0.5} />
            </mesh>
          </group>,
        ];
      })}
    </group>
  );
}
