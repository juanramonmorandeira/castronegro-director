# Cyclic Social Engine - Arquitectura de aplicacion

> Documento de trabajo. Los diagramas Mermaid se renderizan en GitHub y en la vista previa de VS Code.

> El dominio vigente esta documentado en [`README.md`](./README.md) y
> [`domain_architecture.md`](./domain_architecture.md).

> [`historial_codex_resumen.md`](./historial_codex_resumen.md) y
> [`modelo_objetivo_sesion.md`](./modelo_objetivo_sesion.md) son archivo
> historico y no definen el motor actual.

> Decision tecnica: la extraccion del nucleo limpio esta descrita en [`decision_nucleo_limpio.md`](./decision_nucleo_limpio.md).

## 1) Flujo de pantallas (alto nivel)

```mermaid
flowchart LR
  AUTH_LOGIN{Login<br>- storyteller or player<br>- acceso con email verificado} -->|Register| AUTH_REG[Registration<br>- nombre obligatorio<br>- nickname/alias opcional<br>- avatar opcional<br>- email obligatorio]
  AUTH_REG --> AUTH_VERIFY[Email verification<br>- envío de correo<br>- activar cuenta]
  AUTH_VERIFY --> AUTH_LOGIN
  AUTH_LOGIN -->|Storyteller| L[Landing<br>- current session status<br>- create new session<br>- open running session<br>- access history]
  AUTH_LOGIN -->|Player| SEL

  subgraph Storyteller
    direction TB
    L --View--> H[History<br>- past sessions list<br>- open summary/log modal]
    H --Close--> L
    L --Create new session--> C[Config<br>- connected/ready counters<br>- language selector<br>- properties<br>- match roles<br>- distribution<br>- QR code]
    C --> PROPS([Properties<br>- gameplay language<br>- storyteller mode humana, asistida o IA<br>- ruleset preset<br>- players count<br>- roles pool<br>- professions on demand])
    PROPS --Close--> C
    C --> MATCH_SETUP([Match<br>- asignar roles<br>- asignar profesiones])
    MATCH_SETUP --Close--> C
    C --> DISTRIBUTION([Distribution<br>- fisical map of players])
    DISTRIBUTION --Colse--> C
    C --> QR_MODAL([Share<br>- QR code<br>- session ID])
    QR_MODAL --Close--> C
    C --Start--> S[Session panel<br>- pool and stage flow<br>- map<br>- bitacora]
    C --Cancel--> L
    S --Edit--> C
    L --View session--> S
    S --> MAP_PANEL([Map<br>- distribution view<br>- roles order night<br>- tokens/effects])
    MAP_PANEL --Close--> S
    MAP_PANEL --> ROLE_DETAIL[Rol details<br>- Image and name]
    ROLE_DETAIL --Close--> MAP_PANEL
    S --> LOGBOOK([Bitácora<br>- notas de la sesión])
    LOGBOOK --Close--> S
  end

  S --Start--> CR

  subgraph Players
    direction TB
    QR_MODAL --Share--> SEL[Selection<br>- scan QR code<br>- insert session ID<br>- pick from list]
    SEL --> W[Waiting<br>- expected users<br>- connected players<br>- ready players<br>- messages display<br>- session narrative history]
    W --Ready--> CR[Character roll<br>- role name<br>- description<br>- ability & flavor text]
  end
  
```

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> waiting: createSession()
  waiting --> match: reachExpectedPlayers()
  match --> ready: assignRoles() / confirmSeating()
  note right of ready
    Character roll (selección de rol + mensaje privado)
    se muestra aquí antes del check final.
  end note
  ready --> in_progress: startGame()
  in_progress --> in_progress: concludePlay(playOutcome)
  in_progress --> finished: creator closes session
  in_progress --> paused: pauseGame()
  paused --> in_progress: resume()
  draft --> cancelled
  waiting --> cancelled
  match --> cancelled
  ready --> cancelled
  in_progress --> cancelled

  note right of in_progress
    Transiciones válidas:
    - conclude_play no cierra administrativamente la session
    - in_progress → finished por decision del creador
    - in_progress → paused
    - in_progress → cancelled
  end note
```

```mermaid
erDiagram
  SESSIONS {
    string id PK
    string title
    string status
    timestamp created_at
    timestamp updated_at
    bool is_current
    number expected_players
    string language
    string storyteller_uid
    string ruleset_id
  }

  PLAYERS {
    string id PK
    string session_id FK
    string display_name
    string avatar_url
    string role_id
    bool in_play
    bool is_storyteller
    timestamp joined_at
  }

  ROLES {
    string id PK
    string role_key
    string alignment_id
    bool enabled
  }

  LOGS {
    string id PK
    string session_id FK
    string type
    string message
    timestamp at
  }

  SESSIONS ||--o{ PLAYERS : has
  SESSIONS ||--o{ LOGS : writes
  ROLES ||--o{ PLAYERS : assigned_to
```

## Comentarios y pendientes

- <!-- pendiente: --> Validar qué reglas específicas se controlan desde `Properties` (roles predefinidos vs. configuración ad-hoc) para modelarlo en la base de datos.
- <!-- pendiente: --> Definir si el flujo de `Selection` necesita mostrar sesiones previas abiertas por el mismo storyteller o sólo acepta QR/ID directo.
- <!-- pendiente: --> Confirmar si la pantalla `Character roll` debe persistir mensajes personalizados por jugador o si basta con derivarlos del catálogo de roles.
- <!-- nota: --> Los nombres visibles, textos e imagenes pertenecen a skin. El
  motor guarda `roleKey`, `alignmentId` y estado runtime.
