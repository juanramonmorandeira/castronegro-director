import gamesMetadata from '../../village_db/definitions/games_metadata.json' assert { type: 'json' };
import balanceTable from '../../village_db/rulesets/balance_table.json' assert { type: 'json' };
import resourcesTable from '../../village_db/rulesets/resources_table.json' assert { type: 'json' };

export function getGamesMetadata() {
  return gamesMetadata;
}

export function getBalanceTable() {
  return balanceTable;
}

export function getResourcesTable() {
  return resourcesTable;
}

export function getAssistTasks() {
  return gamesMetadata?.assist_tasks_values ?? [];
}
