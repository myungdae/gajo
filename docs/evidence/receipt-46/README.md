# Receipt 46 — voice input and conversation continuity

Base: f41fa32b2fa0f08e3163d4acaaf019ad5920403e. Local implementation only.

## Confirmed causes

- ConciergePage could run high-confidence voice requests automatically and rewrote the recognized sentence through Korean slot heuristics.
- VoiceConfirmation did not expose full-text editing. Its onChange callback was unused.
- Recognition appended to the text composer. Cancel/error/unmount could still allow late recognition callbacks; no-speech/network handling was incomplete.
- NOW closed the composer after a successful response.
- Only the Nearby shortcut kept a partial navigation-state snapshot. The conversation anchor, discovery context, explicit journey and alternative selection were not restored.
- Microphone permission waiting temporarily disables its button and can remove keyboard focus. Escape must work even in that case.

## Implemented behavior

- Inline panel with reviewed ko/en start, listening, stop, review, edit, send, restart, cancel, sending, permission and failure copy.
- All voice results require explicit confirmation. Confirmed original/edited text enters the existing FREE_TEXT request path. The UI language is a recognition hint (ko-KR/en-US), not a filter or translation of the question.
- Draft speech is React state only. No recording API, audio upload, audio storage or new translation/voice service was introduced.
- A single recognition session detaches handlers on cancellation/error/unmount. Visibility, pagehide, history navigation and locale changes end recognition.
- Synchronous request guard precedes location preflight and prevents double sends.
- Confirmed conversations are scoped to region + TripSession ID + NOW/PLAN mode in tab sessionStorage, with a 24-hour expiry. No voice draft is included. Storage failure leaves current React state usable.
- Restores messages, current result, anchor, discovery context, explicit journey and excluded candidates. Choosing another candidate updates the subject for the next question.
- The composer remains available after a response. Original text entry and TripSession storage behavior remain in use.
- Inline SVG microphone, named controls, live status, Escape cancellation, focus on opening/review, 44px minimum controls and compact 200% reflow.

## Automated verification

- Client npm run test:all: 483 passed, 0 failed, 0 skipped.
- Client npm run build: successful, including PWA production assets. Existing build-tool deprecation warning remains.
- No Server source changes.
- Existing tests remain. Assertions for old automatic execution, selective slot UI and partial history snapshots were replaced with stronger mandatory-confirmation/full-text/continuity checks. No skip/only/todo was added.
- speechSession.test.ts: gestures, duplicate start, ko/en hints with opposite-language speech, interim/final results, repeated events, empty results, all error paths, abort/late callbacks, restart, start failure and duplicate gating.
- conversationMemory.test.ts: all regions and modes, trip isolation, localized links, expiry/corrupt/unavailable storage.
- receipt46-browser.mjs: 39 checks in actual headless Chrome with synthetic SpeechRecognition and intercepted local API responses. No production API was contacted.
  - 24 region × locale × NOW/PLAN combinations.
  - Recognition → editing → one request → response → recommendation/detail → navigation/phone handoff → saved place → another candidate → Nearby/back → follow-up in the same conversation.
  - Unsupported browser in ko/en; permission denial, empty/error, restart/edit, blank/duplicate prevention, cancellation, Escape and unmount late events.
  - Active recognition cancellation on locale change and en-US on the next gesture.
  - Accessibility tree names for transcript editor and confirm button.
  - Ten ko/en layouts: 360×800, 390×700, 390×844, 844×390, and 195×422 (390×844 at 200% equivalent CSS reflow).
  - No document/panel horizontal overflow; main content stays above bottom navigation; voice buttons at least 44px.
- browser-report.json contains machine-readable results. PNGs show review states, listening and permission denial.
- API responses and place/phone/navigation values are synthetic. Incidental non-voice backend response copy in screenshots is not production translation evidence.

## Manual device verification still required

- iPhone Safari (including webkitSpeechRecognition) and Android Chrome with real microphone hardware.
- Native permission allow/deny/re-enable dialogs, browser service availability, speech accuracy/noisy surroundings, accents and mixed-language utterances.
- Actual OS keyboard/visual viewport changes, native 200% zoom, background/lock/phone-call interruptions.
- VoiceOver/TalkBack reading and focus behavior.
- Real navigation-app and telephone-app launch, then returning to the same conversation. Automation recorded/prevented these external handoffs.
- Browser speech services may process recognition outside this app according to browser behavior. This app does not record or store audio.

## Reproduction

Start the local Client on 127.0.0.1:5176 and a dedicated Chrome debugging instance on 127.0.0.1:9226, then run node scripts/receipt46-browser.mjs from client. The script uses a dedicated tab, synthetic recognition, blocks HTTPS network requests and intercepts /api/ calls. Use only an isolated local test browser: the fixture clears that origin's browser storage.

No push, production pull/build/deployment, DB/environment changes or Docker actions were performed.
