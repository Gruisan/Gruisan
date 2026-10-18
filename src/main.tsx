import React from 'react';
import ReactDOM from 'react-dom/client';
import layoutJson from '../config/layout.json';
import demoJson from './data/demo-data.json';
import App from './App';
import type { Layout } from './domain/layout';
import type { Snapshot } from './domain/types';
import { LocalDemoProvider } from './providers/LocalDemoProvider';
import { useStore } from './store/useStore';
import './index.css';

const layout = layoutJson as Layout;
// Copie profonde : le jeu de démonstration embarqué n'est jamais muté.
const provider = new LocalDemoProvider({ demo: () => structuredClone(demoJson as Snapshot) });
void useStore.getState().init(provider, layout);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
