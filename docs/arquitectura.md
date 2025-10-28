# Village Storyteller — Arquitectura (borrador vivo)

> Documento de trabajo. Los diagramas Mermaid se renderizan en GitHub y en la vista previa de VS Code.

## 1) Flujo de pantallas (alto nivel)

```mermaid
flowchart LR
  AUTH_LOGIN[Login\n- storyteller or player\n- acceso con email verificado] -->|Registrarse| AUTH_REG[Registration\n- nombre obligatorio\n- nickname/alias opcional\n- avatar opcional\n- email obligatorio]
  AUTH_REG --> AUTH_VERIFY[Email verification\n- envío de correo\n- activar cuenta]
  AUTH_VERIFY --> AUTH_LOGIN
  AUTH_LOGIN -->|Narrador| L[Landing\n- session status\n- new session\n- edit session\n- history table]
  AUTH_LOGIN -->|Jugador| SEL

  subgraph Storyteller
    direction TB
    L --> C[Config\n- expected players\n- dataset/roles\n- language\n- stage channel]
    C --> PROPS[Properties\n- set new roles\n- set audio/text rules\n- session defaults]
    PROPS --> S[Session panel\n- day/night order\n- right/left order\n- change panel]
    L --> H[History\n- summary\n- logs]
    L --> E[Edit session\n- current session]
    E -->|Volver| L
  end

  subgraph Players
    direction TB
    QR[QR code\n- accede a sesión] --> SEL[Selection\n- scan QR code\n- insert session ID\n- pick from list]
    SEL --> W[Waiting\n- add users\n- expected players\n- messages]
    W --> M[Match\n- players ready]
    M --> R[Ready\n- storyteller checklist]
    R --> CR[Character roll\n- role name\n- description\n- ability & flavor text]
    CR --> S
  end

  S --> G[Start Game\n- run session]
  G --> P[Predict / Finish\n- cierre]
  P --> H

  LOG[Logs] --> H
  S <-->|Compartir QR| QR
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
