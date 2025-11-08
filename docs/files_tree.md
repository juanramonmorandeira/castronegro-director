## Village Storyteller – estructura de archivos

```text
reference-data/
├── metadata/
│   └── games.json            # Configuración base de partidas y defaults
├── rulesets/
│   ├── balance_table.json    # Distribuciones sugeridas de roles/fases
│   └── resources_table.json  # Otros recursos auxiliares para el storyteller
├── datasets/                 # (Opcional) datasets analíticos o investigación
├── images/                   # Referencias para scripts de utilidades
└── users/                    # Plantillas/seeds para scripts externos

src/
├── App.svelte                 # Router ligero entre pantallas
├── assets/                    # Recursos estáticos empaquetados con Vite
├── components/
│   ├── common/                # UI compartida reutilizable entre pantallas
│   │   ├── BackgroundLayer.svelte
│   │   ├── Footbar.svelte
│   │   └── Topbar.svelte
│   └── storytellers/          # Módulos específicos del dashboard storyteller
│       ├── CurrentSessionCard.svelte
│       └── HistoryCard.svelte
├── lib/                       # Lógica de dominio (APIs, utilidades, i18n…)
├── pages/                     # Pantallas de alto nivel (enrutadas por App.svelte)
│   ├── Configure.svelte
│   ├── Login.svelte
│   ├── Selection.svelte
│   ├── Profile.svelte
│   ├── Registration.svelte
│   ├── Storyteller.svelte
│   └── VerifyEmail.svelte
└── app.css                    # Estilos globales
```

Notas:

- `App.svelte` decide qué entrada de `src/pages/` montar según el estado de autenticación y modo de sesión.
- Los componentes dentro de `src/components/common/` se consideran “lego blocks” compartidos; si una nueva pantalla necesita cabecera, fondo o pie, debe importar desde allí.
- Los elementos de `src/components/storytellers/` son piezas específicas del panel Storyteller y pueden migrarse a otras carpetas de `components/` si surgen más dominios.
- `src/lib/` mantiene dependencias puras de la UI (Firebase, Firestore, helpers de i18n…); cualquier lógica que no dependa de Svelte debería residir aquí.
- `reference-data/` concentra el material JSON estático (metadata y tablas de reglas) junto con carpetas opcionales para datasets, imágenes o seeds que puedas añadir cuando hagan falta.
