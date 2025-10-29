# Village Storyteller — Arquitectura (borrador vivo)

> Documento de trabajo. Los diagramas Mermaid se renderizan en GitHub y en la vista previa de VS Code.

## 1) Flujo de pantallas (alto nivel)

```mermaid
flowchart TB
  subgraph Authentication
    direction TB
    AUTH_LOGIN[Login<br>- storyteller or player<br>- acceso con email verificado]
    AUTH_LOGIN -->|Register| AUTH_REG[Registration<br>- nombre obligatorio<br>- nickname/alias opcional<br>- avatar opcional<br>- email obligatorio]
    AUTH_REG --> AUTH_VERIFY[Email verification<br>- envío de correo<br>- activar cuenta]
    AUTH_VERIFY --> AUTH_LOGIN
  end

  AUTH_LOGIN -->|Storyteller| L
  AUTH_LOGIN -->|Player| QR_ENTRY

  subgraph Storyteller Journey
    direction TB
    L[Landing<br>- current session status<br>- create new session<br>- open running session<br>- access history]
    L -->|Create new session| C[Config<br>- players connected/ready counters<br>- dataset y roles<br>- language selector<br>- stage channel]
    L --> H[History<br>- past sessions list<br>- open summary/log modal]
    H --> L
    L --> VIEW[View session<br>- current session]
    VIEW --> S
    C --> START[Start session]
    START --> S
    C --> CANCEL[Cancel session]
    CANCEL --> L

    subgraph Config Tools
      direction LR
      C --> QR_MODAL[Share session<br>- QR code<br>- session ID]
      QR_MODAL -.-> C
      C --> PROPS[Properties<br>- gameplay language<br>- storyteller mode humana, asistida o IA<br>- ruleset preset<br>- players count<br>- roles pool<br>- professions on demand]
      PROPS -.-> C
      C --> MATCH_SETUP[Match setup<br>- asignar roles<br>- asignar profesiones]
      MATCH_SETUP -.-> C
      C --> DISTRIBUTION[Distribution<br>- fisical map of players]
      DISTRIBUTION -.-> C
    end
  end

  subgraph Session Experience
    direction LR
    S[Session panel<br>- day/night order<br>- right/left order<br>- change panel]
    S --> SESSION_CONTROLS["Session controls (UI panel)<br>- pause/stop<br>- resume<br>- edit config"]
    SESSION_CONTROLS -.-> S
    SESSION_CONTROLS -.-> C
    S --> MAP_PANEL[Map<br>- distribution view<br>- roles order night<br>- tokens/effects]
    MAP_PANEL --> ROLE_DETAIL[Rol details<br>- Image and name]
    ROLE_DETAIL -.-> MAP_PANEL
    S --> LOGBOOK[Bitácora<br>- notas de la sesión]
    LOGBOOK -.-> S
    S --> DAY_FLOW["Day phases (UI panel)<br>- narration<br>- debate<br>- candidacy<br>- voting"]
    DAY_FLOW -.-> S
    S --> NIGHT_FLOW["Night sequence (UI panel)<br>- dynamic role order"]
    NIGHT_FLOW -.-> S
  end

  subgraph Player Entry
    direction TB
    QR[QR code<br>- accede a sesión] --> SEL[Selection<br>- scan QR code<br>- insert session ID<br>- pick from list]
    SEL --> W[Waiting<br>- add users<br>- expected players<br>- messages]
    W --> M[Match<br>- players ready]
    M --> R[Ready<br>- storyteller checklist]
    R --> CR[Character roll<br>- role name<br>- description<br>- ability & flavor text]
    CR --> S
  end

  QR_MODAL -->|Share QR| QR
  QR_ENTRY --> QR
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
  in_progress --> finished: endGame(winner)
  in_progress --> paused: pauseGame()
  paused --> in_progress: resume()
  draft --> cancelled
  waiting --> cancelled
  match --> cancelled
  ready --> cancelled
  in_progress --> cancelled

  note right of in_progress
    Transiciones válidas:
    - in_progress → finished
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
    bool is_alive
    bool is_storyteller
    timestamp joined_at
  }

  ROLES {
    string id PK
    string name
    string alignment
    string description
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
- <!-- nota: --> `alignment` en roles se acota a `villager|wolf|neutral|special`; `type` en logs a `info|warn|error|action`.
