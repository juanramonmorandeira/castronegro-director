# Inventario provisional: legacy phase -> step

Este documento lista los nombres antiguos de steps encontrados en
`Session.svelte` y propone nombres anonimizados de `step`.

No es una migracion automatica. Es una tabla de referencia para revisar conforme
vayamos implementando roles.

## Convencion

```text
pool -> step -> recipe -> action/effect
```

Ejemplo:

```text
poolEachDay -> stepVoteOutOfPlay -> obsolete_composite_vote_recipe -> vote + obsolete_followup_action(set_in_play false)
```

## Ya acordados

| Pool | Legacy phase | Step candidato | Action | Estado |
|---|---|---|---|---|
| `poolFirstNight` / `poolEachNight` | `phaseSeer` | `stepInspectRole` | `inspect_role` | acordado |
| `poolFirstNight` | `phaseCupid` | `stepLinkTargets` | `link_targets` | acordado |
| `poolFirstNight` / `poolEachNight` | `phaseDefender` | `stepBlockOutOfPlay` | `block_out_of_play` | acordado |
| `poolEachDay` / `poolSpecialEvents` | `phaseVote` | `stepVoteOutOfPlay` | `obsolete_composite_vote_recipe` recipe | acordado |

## Preparation

| Pool | Legacy phase | Step candidato | Estado |
|---|---|---|---|
| `poolPreparation` | `phaseCharacters` | `stepAssignRoleInstances` | candidato |
| `poolPreparation` | `phaseBuildings` | `stepAssignContextModules` | candidato |
| `poolPreparation` | `phaseManipulator` | `stepSplitGroups` | candidato |
| `poolPreparation` | `phaseGypsyCards` | `stepPrepareChoiceDeck` | candidato |
| `poolPreparation` | `phaseTownCrierCards` | `stepPrepareAnnouncementDeck` | candidato |
| `poolPreparation` | `phaseActorCards` | `stepPrepareRoleOptions` | candidato |
| `poolPreparation` | `phaseThiefCards` | `stepPrepareRoleSwapOptions` | candidato |
| `poolPreparation` | `phaseSheriffElection` | `stepVoteAssignMarker` | candidato |

## First Night

| Pool | Legacy phase | Step candidato | Estado |
|---|---|---|---|
| `poolFirstNight` | `phaseThief` | `stepChooseRoleSwap` | candidato |
| `poolFirstNight` | `phaseActor` | `stepChooseTemporaryAction` | candidato |
| `poolFirstNight` | `phaseCupid` | `stepLinkTargets` | acordado |
| `poolFirstNight` | `phaseSeer` | `stepInspectRole` | acordado |
| `poolFirstNight` | `phaseFox` | `stepInspectGroup` | candidato |
| `poolFirstNight` | `phaseLovers` | `stepRevealRelationToMembers` | candidato |
| `poolFirstNight` | `phaseJudgeSignal` | `stepSetTriggerSignal` | candidato |
| `poolFirstNight` | `phaseSisters` | `stepRevealGroupMembers` | candidato |
| `poolFirstNight` | `phaseBrothers` | `stepRevealGroupMembers` | candidato |
| `poolFirstNight` | `phaseChild` | `stepChooseReferenceTarget` | candidato |
| `poolFirstNight` | `phaseTamerLocation` | `stepInspectAdjacentState` | candidato |
| `poolFirstNight` | `phaseScandalmonger` | `stepMarkTarget` | candidato |
| `poolFirstNight` | `phasePyromaniac` | `stepMarkContextTarget` | candidato |
| `poolFirstNight` | `phaseDefender` | `stepPreventOutOfPlay` | acordado |
| `poolFirstNight` | `phasePack` | `stepFactionSetOutOfPlay` | candidato |
| `poolFirstNight` | `phaseHound` | `stepChooseFactionMode` | candidato |
| `poolFirstNight` | `phaseGirl` | `stepPassiveObservationWindow` | candidato |
| `poolFirstNight` | `phaseBaker` | `stepPassiveTimingSignal` | candidato |
| `poolFirstNight` | `phaseFather` | `stepChangeFaction` | candidato |
| `poolFirstNight` | `phaseBad` | `stepFactionSetOutOfPlayBonus` | candidato |
| `poolFirstNight` | `phaseWitch` | `stepChooseStoredEffect` | candidato |
| `poolFirstNight` | `phaseGypsy` | `stepAssignTemporaryRole` | candidato |
| `poolFirstNight` | `phasePiper` | `stepSetFlagOnTargets` | candidato |
| `poolFirstNight` | `phaseCharmed` | `stepRevealFlaggedGroup` | candidato |

## Each Night

| Pool | Legacy phase | Step candidato | Estado |
|---|---|---|---|
| `poolEachNight` | `phaseActor` | `stepChooseTemporaryAction` | candidato |
| `poolEachNight` | `phaseSeer` | `stepInspectRole` | acordado |
| `poolEachNight` | `phaseFox` | `stepInspectGroup` | candidato |
| `poolEachNight` | `phaseSisters` | `stepRevealGroupMembers` | candidato |
| `poolEachNight` | `phaseBrothers` | `stepRevealGroupMembers` | candidato |
| `poolEachNight` | `phaseScandalmonger` | `stepMarkTarget` | candidato |
| `poolEachNight` | `phasePyromaniac` | `stepMarkContextTarget` | candidato |
| `poolEachNight` | `phaseDefender` | `stepPreventOutOfPlay` | acordado |
| `poolEachNight` | `phasePack` | `stepFactionSetOutOfPlay` | candidato |
| `poolEachNight` | `phaseGirl` | `stepPassiveObservationWindow` | candidato |
| `poolEachNight` | `phaseBaker` | `stepPassiveTimingSignal` | candidato |
| `poolEachNight` | `phaseWhite` | `stepFactionSetOutOfPlayRestricted` | candidato |
| `poolEachNight` | `phaseFather` | `stepChangeFaction` | candidato |
| `poolEachNight` | `phaseBad` | `stepFactionSetOutOfPlayBonus` | candidato |
| `poolEachNight` | `phaseWitch` | `stepChooseStoredEffect` | candidato |
| `poolEachNight` | `phaseGypsy` | `stepAssignTemporaryRole` | candidato |
| `poolEachNight` | `phasePiper` | `stepSetFlagOnTargets` | candidato |
| `poolEachNight` | `phaseCharmed` | `stepRevealFlaggedGroup` | candidato |

## Each Day

| Pool | Legacy phase | Step candidato | Estado |
|---|---|---|---|
| `poolEachDay` | `phaseVictims` | `stepResolvePendingEffects` | candidato |
| `poolEachDay` | `phaseTamer` | `stepRevealAdjacentState` | candidato |
| `poolEachDay` | `phaseMedium` | `stepRevealTemporaryMessage` | candidato |
| `poolEachDay` | `phaseTownCrier` | `stepRevealAnnouncement` | candidato |
| `poolEachDay` | `phaseDebate` | `stepOpenDiscussion` | candidato |
| `poolEachDay` | `phaseSheriff` | `stepApplyVoteWeightMarker` | candidato |
| `poolEachDay` | `phaseVote` | `stepVoteOutOfPlay` | acordado |
| `poolEachDay` | `phaseServant` | `stepOptionalRoleSwapAfterOutOfPlay` | candidato |
| `poolEachDay` | `phaseJudge` | `stepOptionalRepeatVote` | candidato |

## Special Events

| Pool | Legacy phase | Step candidato | Estado |
|---|---|---|---|
| `poolSpecialEvents` | `phaseHunter` | `stepFinalTargetAction` | candidato |
| `poolSpecialEvents` | `phaseScapegoat` | `stepAssignVoteRestrictions` | candidato |
| `poolSpecialEvents` | `phaseSheriffElection` | `stepVoteAssignMarker` | candidato |
| `poolSpecialEvents` | `phaseVote` | `stepVoteOutOfPlay` | acordado |
| `poolSpecialEvents` | `phaseServant` | `stepOptionalRoleSwapAfterOutOfPlay` | candidato |
| `poolSpecialEvents` | `phaseEnd` | `stepEndSession` | candidato |

## Nota

Algunos candidatos comparten nombre porque probablemente representan la misma
mecanica abstracta:

- `phaseSisters` y `phaseBrothers` -> `stepRevealGroupMembers`
- `phasePack`, `phaseWhite`, `phaseBad` -> variantes de set out of play por
  faccion o subtipo de faccion
- `phasePiper` y futuros estados similares -> `stepSetFlagOnTargets`

La decision final debe tomarse cuando implementemos cada mecanica.
