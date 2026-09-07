import test from "node:test";
import assert from "node:assert/strict";
import {
  JOURNEY_SOUND_MUTED_KEY,
  journeySoundMuted,
  playJourneySound,
  setJourneySoundMuted,
} from "./journeySound.ts";

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

test("journey sound preference is explicit and persistent", () => {
  const storage = memory();
  assert.equal(journeySoundMuted(storage), false);
  setJourneySoundMuted(true, storage);
  assert.equal(storage.getItem(JOURNEY_SOUND_MUTED_KEY), "true");
  assert.equal(journeySoundMuted(storage), true);
});

test("muted and unsupported browsers stay silent without failing", () => {
  assert.equal(playJourneySound("change", "muted-event", { muted: true }), false);
  assert.equal(
    playJourneySound("ready", "unsupported-event", {
      muted: false,
      AudioContext: undefined,
    }),
    false,
  );
});
