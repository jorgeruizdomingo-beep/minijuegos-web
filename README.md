# Minijuegos web

Web de minijuegos incrementales (clickers e idle) que se juegan en el navegador. Sin servidor: el progreso se guarda en el propio navegador y se abona el tiempo que has pasado fuera.

## Juegos

| Juego | Estado | Ruta |
| --- | --- | --- |
| 🐜 Hormiguero (clicker 2D con prestigio) | jugable | `games/hormiguero/` |
| 🪐 Órbita (incremental 3D) | en diseño | `games/orbita/` |

## Desarrollo

```bash
npm install
npm run dev      # servidor local con recarga
npm run build    # type-check + build en dist/
npm run preview  # sirve dist/
```

Estructura:

- `index.html` + `src/main.ts`: portada con el catálogo (`src/core/catalog.ts`).
- `src/core/`: utilidades compartidas (formato de números, guardado con progreso offline).
- `src/games/<juego>/`: lógica (`game.ts`), datos de balance (`data.ts`), interfaz (`ui.ts`), escena (`render.ts`).
- `games/<juego>/index.html`: página de cada juego (Vite multipágina, ver `vite.config.ts`).

## Despliegue

Cada push a `main` construye y publica en GitHub Pages mediante `.github/workflows/deploy.yml`. Los pull requests solo construyen.
