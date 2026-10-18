# Magasin 3D — Digital Stock

Outil PC de visualisation et de gestion d'un magasin de pièces industrielles (démonstration, données fictives).
Livrable : **un seul fichier `dist/magasin3d.html`**, à ouvrir par double-clic dans Edge (file://), sans serveur, sans installation, sans Internet.

## Commandes (poste de développement uniquement — Node n'est pas requis sur le poste cible)

| Commande | Rôle |
|---|---|
| `npm install` | Dépendances |
| `npm run dev` | Serveur de développement (http://localhost:5173/magasin3d.html) |
| `npm test` | Tests Vitest (moteur de stock, persistance, jeu de démo) |
| `npm run build` | Typecheck + build du fichier unique + contrôle du livrable (`scripts/check-dist.mjs`) |
| `npm run e2e` | Vérification Chromium en file://, réseau coupé, fermeture/réouverture réelle du navigateur |
| `node scripts/mesure-fps.mjs [url]` | Mesure des images/s (vue d'ensemble, rotation continue) |
| `npm run generate:demo` | Regénère `src/data/demo-data.json` (seed fixe, résultat identique) |

## Arborescence

```
config/layout.json            Géométrie du magasin (bâtiment, portes, zones, aires au sol, rayonnages, niveaux, emplacements)
src/domain/                   Cœur métier pur (sans React) : types, moteur de stock, layout, index/KPI, rôles simulés, générateur démo
src/providers/                DataProvider (contrat) + LocalDemoProvider + stockage IndexedDB / localStorage / mémoire
src/store/useStore.ts         Store Zustand : l'UI ne lit que lui
src/scene/                    Vue 3D React Three Fiber (instances, étiquettes canvas, caméra)
src/ui/, src/pages/           Interface (barre haute, menu, panneau droit, bandeau, formulaires, pages)
src/data/demo-data.json       Jeu de démonstration généré (embarqué dans le HTML)
scripts/                      Génération démo, contrôle du livrable, e2e file://, mesure FPS
tests/                        Vitest
```

## Persistance en file://

Vérifié par `npm run e2e` avec Chromium 141 (profil persistant, navigateur réellement fermé puis relancé) :
en file://, IndexedDB est disponible (contexte sécurisé : oui) et les mouvements sont retrouvés après réouverture.
Ordre de repli : IndexedDB → localStorage → mémoire (dans ce dernier cas, un bandeau rouge l'indique).
Les données sont liées au profil du navigateur et au chemin du fichier : si le fichier est déplacé, renommé
ou si le navigateur efface ses données, utilisez **Paramètres → Sauvegarde fichier (JSON)** (export / import).

## Remplacer le magasin fictif par le vrai

- Géométrie : `config/layout.json` (phase 4 : éditeur + import/export dans l'interface).
- Données : import Excel avec mapping de colonnes configurable (phase 2).
- Connexion SharePoint : `SharePointListsProvider` à brancher sur l'interface `DataProvider` (phase 5, non connecté).

## Règles métier implémentées (src/domain/engine.ts)

- Stock disponible = somme des emplacements ; stock total = disponible + stand-by ouvert.
- Aucune quantité négative ; sortie/transfert/stand-by supérieurs au disponible refusés avec message.
- Chaque mouvement produit un nouvel état complet ou une erreur : transfert atomique.
- Idempotence : un `MouvementID` déjà historisé est ignoré (le formulaire fixe l'UUID à l'ouverture : un double clic ne duplique pas).
- `AJUSTEMENT` : la quantité saisie est la **quantité comptée** ; l'écart signé est historisé (`Ecart`).
- Stand-by : retours et consommations partiels possibles (`QuantiteRetournee`, `QuantiteConsommee`) ; clos quand plus rien n'est dehors.
