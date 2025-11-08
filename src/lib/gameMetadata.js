import gamesMetadata from '../../reference-data/metadata/games.json' assert { type: 'json' };
import balanceTable from '../../reference-data/rulesets/balance_table.json' assert { type: 'json' };
import resourcesTable from '../../reference-data/rulesets/resources_table.json' assert { type: 'json' };

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
