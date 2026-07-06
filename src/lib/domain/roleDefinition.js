// roleDefinition.js
// -----------------------------------------------------------------------------
// Definicion, constructor y ensamblador de roles.
//
// defineRole describe un tipo mecanico de rol:
// - a que alignment mecanico pertenece por defecto;
// - que stages de pool y stages iniciales especiales puede proponer;
// - que reglas contextuales y reactions aporta;
//
// createRole materializa su estado dentro de una sesion concreta.
// buildRoles ensambla roles runtime desde definiciones y asientos.
// -----------------------------------------------------------------------------

import { normalizeId } from './sessionModel.js';
import { defineStage } from './stageDefinition.js';

export const ROLE_DEFINITION_TYPES = Object.freeze({
  ROLE: 'role',
  SYSTEM: 'system'
});

// Normaliza una reaction tanto en definicion de rol como en rol de sesion.
//
// Mantener una sola puerta evita que una reaction catalogada y una reaction ya
// materializada diverjan en forma. El stage de respuesta se vuelve a pasar por
// defineStage para preservar los defaults de stageDefinition.
function defineRoleReaction(reaction = {}) {
  return {
    ...reaction,
    trigger: { ...(reaction.trigger ?? {}) },
    response: {
      ...(reaction.response ?? {}),
      stage: reaction.response?.stage ? defineStage(reaction.response.stage) : null
    },
    metadata: { ...(reaction.metadata ?? {}) }
  };
}

export function defineRole({
  key,
  type = ROLE_DEFINITION_TYPES.ROLE,
  alignmentId = null,
  stageDefinitions = [],
  specialStageDefinitions = [],
  stageRules = [],
  reactions = [],
  metadata = {}
} = {}) {
  const normalizedKey = normalizeId(key);

  return {
    key: normalizedKey,
    type: normalizeId(type),
    alignmentId: alignmentId ? normalizeId(alignmentId) : null,
    stageDefinitions: (stageDefinitions ?? []).map(defineStage),
    specialStageDefinitions: (specialStageDefinitions ?? []).map(defineStage),
    // stageRules no crean stages propias: declaran oportunidades contextuales
    // dentro de una stage ajena ya existente.
    stageRules: (stageRules ?? []).map((rule) => ({
      ...rule,
      key: normalizeId(rule.key),
      type: normalizeId(rule.type),
      observedStageKey: normalizeId(rule.observedStageKey),
      poolKeys: (rule.poolKeys ?? []).map(normalizeId),
      recipeKeys: (rule.recipeKeys ?? []).map(normalizeId),
      requireInPlay: rule.requireInPlay !== false,
      metadata: { ...(rule.metadata ?? {}) }
    })),
    // Las reacciones son definicion mecanica del rol: "si ocurre X, puedo
    // responder con Y". eventModel sera quien las evalue durante la sesion.
    reactions: (reactions ?? []).map(defineRoleReaction),
    metadata: { ...metadata }
  };
}

export function createRole({
  id,
  roleKey,
  alignmentId = null,
  playerId = null,
  seat = null,
  inPlay = true,
  revealed = false,
  reactions = [],
  stageRules = [],
  blockedPropertyChanges = [],
  flags = {},
  counters = {},
  metadata = {}
} = {}) {
  const normalizedRoleKey = normalizeId(roleKey);

  return {
    id: id || `${normalizedRoleKey || 'role'}-0`,
    roleKey: normalizedRoleKey,
    alignmentId: alignmentId ? normalizeId(alignmentId) : null,
    playerId,
    seat,
    inPlay: !!inPlay,
    revealed: !!revealed,
    reactions: (reactions ?? []).map(defineRoleReaction),
    stageRules: (stageRules ?? []).map((rule) => ({
      ...rule,
      key: normalizeId(rule.key),
      type: normalizeId(rule.type),
      observedStageKey: normalizeId(rule.observedStageKey),
      poolKeys: (rule.poolKeys ?? []).map(normalizeId),
      recipeKeys: (rule.recipeKeys ?? []).map(normalizeId),
      requireInPlay: rule.requireInPlay !== false,
      metadata: { ...(rule.metadata ?? {}) }
    })),
    blockedPropertyChanges: (blockedPropertyChanges ?? []).map((block) => ({
      ...block,
      blockedFor: {
        actorIds: [...(block.blockedFor?.actorIds ?? [])]
      },
      expiresAt: { ...(block.expiresAt ?? {}) },
      metadata: { ...(block.metadata ?? {}) }
    })),
    flags: { ...flags },
    counters: { ...counters },
    metadata: { ...metadata }
  };
}

// Construye estados de rol a partir de asientos.
//
// Esta funcion traduce una configuracion externa de seating al formato mecanico
// de session.roles. No crea un tipo nuevo de objeto: convierte roles ya
// definidos en roles concretos de sesion.
export function buildRoles(seats = [], roleDefinitions = {}) {
  const counters = new Map();

  return (seats ?? []).map((seatEntry = {}, index) => {
    const roleKey = normalizeId(seatEntry.roleKey ?? seatEntry.role ?? seatEntry.name);
    const count = counters.get(roleKey) ?? 0;
    if (roleKey) counters.set(roleKey, count + 1);

    const roleId = seatEntry.id || (roleKey ? `${roleKey}-${count}` : `empty-${index}`);
    const definition = roleDefinitions[roleKey] ?? {};
    return createRole({
      id: roleId,
      roleKey,
      alignmentId: seatEntry.alignmentId ?? definition.alignmentId ?? null,
      playerId: seatEntry.playerId ?? seatEntry.player_id ?? null,
      seat: Number.isFinite(seatEntry.seat) ? seatEntry.seat : index,
      reactions: definition.reactions ?? [],
      stageRules: definition.stageRules ?? [],
      flags: definition.defaultFlags ?? {},
      counters: definition.defaultCounters ?? {},
      metadata: {
        source: 'seating',
        label: seatEntry.label ?? definition.label ?? null
      }
    });
  });
}
