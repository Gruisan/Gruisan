import { CameraControls, Stats } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { tousLesSlots, type Layout } from '../domain/layout';
import { useStore, type VueCamera } from '../store/useStore';
import { Batiment } from './Batiment';
import { Emplacements } from './Emplacements';
import { Rayonnages } from './Rayonnages';

declare global {
  interface Window {
    /** FPS mesuré sur la dernière seconde (lu par les scripts de mesure). */
    __magasinFps?: number;
    /** Contrôles caméra exposés pour les scripts de vérification (lecture de la cible). */
    __magasinCamera?: CameraControls;
    /** Statistiques de rendu de la dernière image. */
    __magasinRendu?: () => { appels: number; triangles: number; dpr: number; largeur: number; hauteur: number };
  }
}

export default function Scene3D({ layout, actif }: { layout: Layout; actif: boolean }) {
  const afficherFps = useStore((s) => s.afficherFps);
  const selectionner = useStore((s) => s.selectionner);
  const qualite = useStore((s) => s.qualite);
  return (
    <Canvas
      key={qualite}
      frameloop={actif ? 'always' : 'never'}
      dpr={qualite === 'eco' ? 1 : [1, 1.5]}
      camera={{ fov: 45, near: 0.1, far: 200, position: [10, 12, 15] }}
      gl={{ antialias: qualite === 'haute', powerPreference: 'high-performance' }}
      onPointerMissed={(e) => e.button === 0 && selectionner(null)}
      data-testid="canvas-3d"
    >
      <color attach="background" args={['#0d1117']} />
      <fog attach="fog" args={['#0d1117', 30, 60]} />
      <hemisphereLight args={['#dfe8f2', '#30363d', 1.6]} />
      <directionalLight position={[6, 12, 8]} intensity={1.6} />
      <directionalLight position={[-8, 6, -6]} intensity={0.5} />
      <Batiment layout={layout} />
      <Rayonnages layout={layout} />
      <Emplacements layout={layout} />
      <Camera layout={layout} />
      <SondeFps />
      {afficherFps && <Stats className="!absolute !left-auto !right-2 !top-2" />}
    </Canvas>
  );
}

function SondeFps() {
  const acc = useRef({ n: 0, t0: performance.now() });
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    window.__magasinRendu = () => ({
      appels: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      dpr: gl.getPixelRatio(),
      largeur: gl.domElement.width,
      hauteur: gl.domElement.height,
    });
  }, [gl]);
  useFrame(() => {
    const a = acc.current;
    a.n++;
    const t = performance.now();
    if (t - a.t0 >= 1000) {
      window.__magasinFps = Math.round((a.n * 1000) / (t - a.t0));
      a.n = 0;
      a.t0 = t;
    }
  });
  return null;
}

const VUES: Record<VueCamera, [number, number, number, number, number, number]> = {
  orbite: [9, 11, 15, 0, 0.8, -0.8],
  dessus: [0, 23, 0.01, 0, 0, 0],
  iso: [14, 14, 14, 0, 0.5, 0],
};

function Camera({ layout }: { layout: Layout }) {
  const ref = useRef<CameraControls>(null);
  const vue = useStore((s) => s.vue);
  const focus = useStore((s) => s.focus);
  const premier = useRef(true);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.maxPolarAngle = Math.PI / 2 - 0.04;
    c.minDistance = 1.2;
    c.maxDistance = 45;
    c.dollyToCursor = true;
    window.__magasinCamera = c;
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    void c.setLookAt(...VUES[vue.mode], !premier.current);
    premier.current = false;
  }, [vue]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !focus) return;
    const s = tousLesSlots(layout).find((x) => x.emplacementId === focus.emplacementId);
    if (!s) return;
    const [x, y, z] = s.centre;
    const [nx, , nz] = s.normale;
    // Vue plongeante depuis l'allée, au-dessus du rayonnage d'en face, légèrement décalée latéralement.
    const lat: [number, number] = [-nz, nx];
    void c.setLookAt(x + nx * 4.4 + lat[0] * 1.4, Math.max(6.8, y + 5), z + nz * 4.4 + lat[1] * 1.4, x, y, z, true);
  }, [focus, layout]);

  return <CameraControls ref={ref} makeDefault smoothTime={0.35} />;
}
