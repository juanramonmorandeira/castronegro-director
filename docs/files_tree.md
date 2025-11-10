## Village Storyteller – mapa de directorios

```text
.
├── docs/
│   ├── arquitectura.md        # Decisiones de sistema y flujos de sesión
│   └── files_tree.md          # (Este documento) referencia rápida de carpetas
├── reference-data/
│   ├── metadata/
│   │   └── games.json         # Estados, transiciones y defaults de las partidas
│   ├── rulesets/
│   │   ├── balance_table.json # Distribución sugerida de roles por número de jugadores
│   │   └── resources_table.json
│   ├── datasets/              # Espacio reservado para estudios/ETL
│   ├── images/                # Insumos para scripts o documentación
│   └── users/                 # Plantillas o seeds externos
├── public/
│   ├── backgrounds/           # Capas visuales (fondos, fog)
│   ├── avatars/               # Avatares por defecto y personalizables
│   ├── buttons/               # Iconos bitmap (ver/editar/borrar)
│   ├── flags/                 # Banderas para selector de idioma
│   └── roles/                 # Sprites usados en la vista de selección de roles
├── src/
│   ├── app.css                # Entrada única que importa tokens + utilidades globales
│   ├── assets/                # SVG o recursos empaquetados por Vite
│   ├── components/
│   │   ├── common/            # Topbar, Footbar, BackgroundLayer, etc.
│   │   ├── config/            # Modales del configurador (Properties, Selection…)
│   │   ├── storytellers/      # CurrentSessionCard, HistoryCard
│   │   └── ui/                # Kit compartido (Card, Button, InputField, Modal…)
│   ├── lib/                   # Firebase, i18n, utilidades de dominio y helpers DB
│   ├── pages/                 # Pantallas enrutable (Login, Registration, Choose, Configure…)
│   └── styles/                # Sistema de diseño en capas (tokens → foundations → utilities → components)
├── dist/                      # Salida de `npm run build` (Vite)
├── tools/                     # Scripts auxiliares (generadores, mantenimiento)
├── firebase*.json             # Configuración de hosting / reglas Firestore
├── firestore.rules            # Reglas de seguridad de la base de datos
├── package.json               # Dependencias y scripts de proyecto
├── svelte.config.js           # Ajustes del compilador Svelte
└── vite.config.js             # Bundler y alias del front-end
```

### Notas clave
- Los tokens de diseño y utilidades viven en `src/styles/` y se importan únicamente desde `src/app.css`.
- Los componentes nuevos deberían apoyarse en el kit `src/components/ui/`; evita duplicar estilos in-line.
- Todos los accesos a Firestore pasan por `src/lib/db.js`, lo que facilita modificar reglas o mocks sin tocar las vistas.
- El contenido estático (reglas, metadatos, seeds) se mantiene en `reference-data/` para poder versionar cambios sin depender del backend.
