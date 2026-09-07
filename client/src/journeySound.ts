export type JourneySoundCue = "change" | "ready" | "success";

export const JOURNEY_SOUND_MUTED_KEY = "exkovia:journey-sound-muted:v1";

export function journeySoundMuted(storage: Pick<Storage, "getItem"> = localStorage) {
  try {
    return storage.getItem(JOURNEY_SOUND_MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setJourneySoundMuted(
  muted: boolean,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  try {
    storage.setItem(JOURNEY_SOUND_MUTED_KEY, String(muted));
  } catch {
    // Sound preference is optional when browser storage is unavailable.
  }
}

const played = new Set<string>();

export function playJourneySound(
  cue: JourneySoundCue,
  eventKey: string,
  environment: {
    muted?: boolean;
    AudioContext?: typeof AudioContext;
  } = {},
) {
  if (!eventKey || played.has(eventKey)) return false;
  if (environment.muted ?? journeySoundMuted()) return false;
  const AudioContextClass =
    environment.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return false;

  try {
    const context = new AudioContextClass();
    const tones =
      cue === "ready"
        ? [
            { frequency: 523.25, delay: 0 },
            { frequency: 659.25, delay: 0.12 },
          ]
        : cue === "success"
          ? [{ frequency: 659.25, delay: 0 }]
          : [{ frequency: 392, delay: 0 }];
    const start = context.currentTime;
    for (const tone of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(0.0001, start + tone.delay);
      gain.gain.exponentialRampToValueAtTime(0.035, start + tone.delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.delay + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + tone.delay);
      oscillator.stop(start + tone.delay + 0.18);
    }
    played.add(eventKey);
    void context.close().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}
