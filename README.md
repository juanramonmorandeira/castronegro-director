# Village Storyteller

Aplicacion Svelte/Vite para configurar, dirigir y registrar partidas construidas
sobre un motor mecanico anonimo.

## Dominio

El nuevo nucleo vive en:

```text
src/lib/domain/
```

No depende de Svelte, Firebase, traducciones ni assets. Su documentacion empieza
en [`docs/README.md`](docs/README.md).

Modelo resumido:

```text
Catalog -> ruleSet -> configuration -> match -> buildSession -> session
session -> cycle -> pools -> stages -> recipes -> actions -> effects
```

## Comandos

```bash
npm install
npm run dev
npm test
npm run build
```

## Estructura

- `src/pages` y `src/components`: experiencia Svelte.
- `src/lib/domain`: motor mecanico.
- `src/lib/db.js`: persistencia de la aplicacion anterior.
- `reference-data`: reglas y material de investigacion, no estado runtime.
