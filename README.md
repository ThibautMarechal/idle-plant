# Le Grainier

Jeu idle de plantes : on sème, on soigne, on vend au bon moment. Le document de design complet est dans [docs/design.md](docs/design.md).

On se tient au milieu d'une verrière octogonale, en 3D, dessinée façon bande dessinée. On sème, on soigne, on vend au bon moment, et chaque geste se fait au doigt : modeler et peindre les pots, bouturer, polliniser, pomper l'eau, cueillir en expédition ou dans la cave à champignons. Tout tourne dans le navigateur, sans serveur, avec une sauvegarde locale.

## Lancer le jeu

```bash
npm install
npm run dev      # serveur de développement, accessible depuis le téléphone sur le réseau local
npm test         # tests de la simulation
npm run build    # version de production dans dist/
```

Ajouter `?vitesse=20` à l'adresse accélère le temps, pratique pour régler l'équilibrage.

## Organisation

La simulation ne dépend pas de l'écran ; tout le reste l'affiche ou la pilote.

- `src/data.ts` : le catalogue (espèces, familles, zones, terres, champignons, équipements, prix).
- `src/sim.ts` : la simulation pure (croissance, soins, marché, achats, cave, expéditions, sauvegarde). C'est elle que testent `tests/`.
- `src/main.ts` : le démarrage et la boucle d'animation.
- `src/scene.ts`, `src/themes.ts`, `src/plants3d.ts`, `src/pots.ts`, `src/styles.ts` : la verrière en 3D, vue à la première personne, ses plantes, ses pots et le rendu encré.
- `src/ui.ts` : l'interface tactile de la serre (gestes, outils, fenêtres) ; `src/sheets.ts` dessine les fiches du bas ; `src/uikit.ts` et `src/icons.ts` regroupent les petits outils et les icônes dessinées.
- Écrans à part, chacun dans son fichier : `src/studio.ts` (atelier de poterie), `src/planet.ts` et `src/pick.ts` (expédition et cueillette), `src/stall.ts` (étal du fleuriste), `src/cellar.ts` et `src/caveui.ts` (cave à champignons), `src/cutting.ts` (bouturage), `src/pollen.ts` (pollinisation).
- `scripts/build-single.mjs` : regroupe le jeu en un seul fichier HTML, pour l'aperçu dans Claude.
