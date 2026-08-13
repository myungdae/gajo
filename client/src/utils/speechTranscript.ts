const normalizeToken = (token: string) => token.normalize('NFKC').toLowerCase().replace(/^[.,!?…。！？]+|[.,!?…。！？]+$/g, '');
const words = (value: string) => value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);

export const SPEECH_RESTART_DELAY_MS = 250;

export function appendSpeechText(existing: string, next: string): string {
  return [existing.trim(), next.trim()].filter(Boolean).join(' ');
}

/** Deduplicates only the trailing committed / leading new boundary. */
export function mergeCommittedSpeech(committed: string, newFinal: string): string {
  const oldWords = words(committed);
  const newWords = words(newFinal);
  if (!newWords.length) return committed.trim();
  let overlap = 0;
  const limit = Math.min(oldWords.length, newWords.length);
  for (let size = limit; size > 0; size -= 1) {
    const oldSuffix = oldWords.slice(-size).map(normalizeToken);
    const newPrefix = newWords.slice(0, size).map(normalizeToken);
    if (oldSuffix.every((word, index) => word === newPrefix[index])) { overlap = size; break; }
  }
  return appendSpeechText(committed, newWords.slice(overlap).join(' '));
}

export function renderSpeechText(baseText: string, committedSpeech: string, interimSpeech: string): string {
  return appendSpeechText(baseText, appendSpeechText(committedSpeech, interimSpeech));
}
