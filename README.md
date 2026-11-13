# Le Grainier

Jeu idle de plantes : on sème, on soigne, on vend au bon moment. Le document de design complet est dans [docs/design.md](docs/design.md).

Cette première version couvre la boucle courte : sachet de graines, serre en 3D avec quatre micro-climats, soins, marché simulé avec nouvelles, réserve, boutique et almanach. Tout tourne dans le navigateur, sans serveur, avec une sauvegarde locale.

## Lancer le jeu

```bash
npm install
npm run dev      # serveur de développement, accessible depuis le téléphone sur le réseau local
npm test         # tests de la simulation
npm run build    # version de production dans dist/
```

Ajouter `?vitesse=20` à l'adresse accélère le temps, pratique pour régler l'équilibrage.

## Organisation

- `src/data.ts` : espèces, zones climatiques, nouvelles du marché.
- `src/sim.ts` : la simulation, sans aucune dépendance à l'écran (croissance, soins, marché, achats, sauvegarde).
- `src/scene.ts` et `src/plants3d.ts` : la serre et les plantes en 3D (three.js).
- `src/ui.ts` : l'interface tactile.
