export type CurrentTurnResult<T = unknown> = {
  turnId: string;
  requestText: string;
  status: "LOADING" | "RESOLVED";
  result?: T;
};

export function beginCurrentTurn<T = never>(turnId: string, requestText: string): CurrentTurnResult<T> {
  return { turnId, requestText, status: "LOADING" };
}

export function resolveCurrentTurn<T>(current: CurrentTurnResult<any> | null, turnId: string, result: T): CurrentTurnResult<T> | null {
  if (!current || current.turnId !== turnId) return current as CurrentTurnResult<T> | null;
  return { turnId, requestText: current.requestText, status: "RESOLVED", result };
}

export function isCurrentTurn(turnId: string | undefined, current: CurrentTurnResult | null) {
  return Boolean(turnId && current?.status === "RESOLVED" && current.turnId === turnId);
}
