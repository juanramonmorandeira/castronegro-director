import { appendEntry } from '../domain/historyModel.js';
import { MESSAGE_TYPES } from './messageDefinition.js';

export function createMessageLogEntry(message, rendered = null) {
  return {
    message: {
      ...message,
      audience: {
        ...message.audience,
        ids: [...(message.audience?.ids ?? [])]
      },
      params: { ...(message.params ?? {}) },
      context: { ...(message.context ?? {}) },
      metadata: { ...(message.metadata ?? {}) }
    },
    rendered: rendered
      ? {
          ...rendered,
          metadata: { ...(rendered.metadata ?? {}) }
        }
      : null
  };
}

function appendSessionMessage(session, collectionName, message, rendered = null) {
  return appendEntry(session, collectionName, createMessageLogEntry(message, rendered), {
    getId: (_entry, history) => `${collectionName}-${history.length}`
  });
}

export function routeMessage({ session = null, applicationLog = [], message, rendered = null } = {}) {
  if (message?.type === MESSAGE_TYPES.APPLICATION) {
    return {
      session,
      applicationLog: [
        ...(applicationLog ?? []),
        {
          id: `applicationLog-${applicationLog?.length ?? 0}`,
          ...createMessageLogEntry(message, rendered)
        }
      ]
    };
  }

  if (!session) return { session, applicationLog };

  const collectionName =
    message?.type === MESSAGE_TYPES.GAMEPLAY ? 'sessionMessageLog' : 'errorLog';

  return {
    session: appendSessionMessage(session, collectionName, message, rendered),
    applicationLog
  };
}

export function routeMessages(state = {}, messages = []) {
  return (messages ?? []).reduce(
    (current, message) => routeMessage({ ...current, message }),
    {
      session: state.session ?? null,
      applicationLog: [...(state.applicationLog ?? [])]
    }
  );
}

export function recordRenderedSessionMessage(session, logId, rendered) {
  return {
    ...session,
    sessionMessageLog: (session.sessionMessageLog ?? []).map((entry) =>
      entry.id === logId
        ? {
            ...entry,
            rendered: {
              ...rendered,
              metadata: { ...(rendered?.metadata ?? {}) }
            }
          }
        : entry
    )
  };
}
