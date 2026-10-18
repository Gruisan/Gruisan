// Structure des rayonnages (montants, lisses, tablettes) en InstancedMesh : 3 draw calls au total
// quel que soit le nombre de rayonnages.
import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { hauteurNiveau, localVersMonde, type Layout, type Rayonnage } from '../domain/layout';
import { useStore } from '../store/useStore';
import { textureTexte } from './textures';

interface Piece {
  rack: number;
  centre: [number, number, number];
  taille: [number, number, number];
  rotationY: number;
}

function pieces(layout: Layout) {
  const montants: Piece[] = [];
  const lisses: Piece[] = [];
  const tablettes: Piece[] = [];
  layout.rayonnages.forEach((r, i) => {
    const rot = (r.rotation * Math.PI) / 180;
    const p = (lx: number, ly: number, lz: number) => localVersMonde(r, lx, ly, lz);
    const nbTravees = Math.max(1, Math.round(r.longueur / 1.35));
    for (let t = 0; t <= nbTravees; t++) {
      const lx = -r.longueur / 2 + (r.longueur * t) / nbTravees;
      for (const lz of [-r.profondeur / 2, r.profondeur / 2]) {
        montants.push({ rack: i, centre: p(lx, r.hauteur / 2, lz), taille: [0.06, r.hauteur, 0.06], rotationY: rot });
      }
    }
    for (let n = 1; n <= r.niveaux; n++) {
      const y = hauteurNiveau(r, n);
      tablettes.push({ rack: i, centre: p(0, y, 0), taille: [r.longueur, 0.025, r.profondeur], rotationY: rot });
      for (const lz of [-r.profondeur / 2, r.profondeur / 2]) {
        lisses.push({ rack: i, centre: p(0, y - 0.04, lz), taille: [r.longueur + 0.04, 0.08, 0.05], rotationY: rot });
      }
    }
  });
  return { montants, lisses, tablettes };
}

function Instances({ liste, couleur, onClick }: { liste: Piece[]; couleur: string; onClick: (e: ThreeEvent<MouseEvent>, p: Piece) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!;
    const o = new THREE.Object3D();
    liste.forEach((p, i) => {
      o.position.set(...p.centre);
      o.rotation.set(0, p.rotationY, 0);
      o.scale.set(...p.taille);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [liste]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, liste.length]}
      onClick={(e) => e.instanceId !== undefined && onClick(e, liste[e.instanceId])}
    >
      <boxGeometry />
      <meshLambertMaterial color={couleur} />
    </instancedMesh>
  );
}

export function Rayonnages({ layout }: { layout: Layout }) {
  const { montants, lisses, tablettes } = useMemo(() => pieces(layout), [layout]);
  const selectionner = useStore((s) => s.selectionner);
  const click = (e: ThreeEvent<MouseEvent>, p: Piece) => {
    if (e.delta > 5) return; // glisser-déposer de la caméra, pas un clic
    e.stopPropagation();
    selectionner({ type: 'rayonnage', id: layout.rayonnages[p.rack].id });
  };
  return (
    <group>
      <Instances liste={montants} couleur="#2f6fb2" onClick={click} />
      <Instances liste={lisses} couleur="#e07b1f" onClick={click} />
      <Instances liste={tablettes} couleur="#7c8792" onClick={click} />
      {layout.rayonnages.map((r) => (
        <EtiquetteRayonnage key={r.id} r={r} couleur={layout.zones.find((z) => z.id === r.zone)?.couleur ?? '#888'} />
      ))}
      <ContourSelection layout={layout} />
    </group>
  );
}

function EtiquetteRayonnage({ r, couleur }: { r: Rayonnage; couleur: string }) {
  const { texture, ratio } = textureTexte(r.id, { couleur: '#ffffff', fond: couleur, taille: 64 });
  const selectionner = useStore((s) => s.selectionner);
  const [x, , z] = localVersMonde(r, 0, 0, 0);
  return (
    <sprite
      position={[x, r.hauteur + 0.3, z]}
      scale={[0.38 * ratio, 0.38, 1]}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        selectionner({ type: 'rayonnage', id: r.id });
      }}
    >
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}

function ContourSelection({ layout }: { layout: Layout }) {
  const selection = useStore((s) => s.selection);
  const id = selection?.type === 'rayonnage' ? selection.id : selection?.type === 'emplacement' ? selection.id.split('-')[1] : null;
  const r = layout.rayonnages.find((x) => x.id === id);
  const geo = useMemo(() => (r ? new THREE.EdgesGeometry(new THREE.BoxGeometry(r.longueur + 0.1, r.hauteur + 0.05, r.profondeur + 0.1)) : null), [r]);
  if (!r || !geo) return null;
  return (
    <lineSegments geometry={geo} position={[r.x, r.hauteur / 2, r.z]} rotation-y={(r.rotation * Math.PI) / 180}>
      <lineBasicMaterial color={selection?.type === 'rayonnage' ? '#f5b301' : '#6b7a8c'} />
    </lineSegments>
  );
}
