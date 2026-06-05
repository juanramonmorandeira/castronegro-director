// playerDefinition.js
// -----------------------------------------------------------------------------
// Constructor de players de sesion.
//
// Un player representa a quien ocupa un asiento o controla una parte de la
// partida. No es lo mismo que role: el motor aplica reglas sobre roles,
// mientras que player sirve para identidad, conexion y preparacion.
// -----------------------------------------------------------------------------

import { PLAYER_TYPES, normalizeId } from './sessionModel.js';

export function createPlayer({
  id,
  displayName,
  type = PLAYER_TYPES.HUMAN,
  connected = false,
  ready = false,
  metadata = {}
} = {}) {
  const normalizedId = id || normalizeId(displayName);
  return {
    id: normalizedId,
    displayName: displayName || normalizedId,
    type,
    connected: !!connected,
    ready: !!ready,
    metadata: { ...metadata }
  };
}
