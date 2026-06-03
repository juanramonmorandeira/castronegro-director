// index.js
// -----------------------------------------------------------------------------
// Este archivo es un "barrel export": una puerta unica de salida.
//
// No exporta "a algun sitio" automaticamente.
// Simplemente permite que otros archivos importen desde una sola ruta:
//
// import { createGameSession, advancePhaseCursor } from './domain/index.js';
//
// en vez de tener que saber en que archivo exacto vive cada funcion.
// -----------------------------------------------------------------------------

export * from './sessionModel.js';
export * from './sessionValidation.js';
export * from './historyModel.js';
export * from './roleDefinition.js';
export * from './roleCatalog.js';
export * from './groupDefinition.js';
export * from './groupCatalog.js';
export * from './stepDefinition.js';
export * from './stepCatalog.js';
export * from './phaseDefinition.js';
export * from './phaseModel.js';
export * from './recipeCatalog.js';
export * from './recipeModel.js';
export * from './effectModel.js';
export * from './constraintModel.js';
export * from './modifierModel.js';
export * from './resolverModel.js';
export * from './victoryModel.js';
export * from './voteModel.js';
export * from './actionModel.js';
export * from './stepModel.js';
