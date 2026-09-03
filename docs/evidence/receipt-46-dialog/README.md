# Receipt 46: compact voice dialog follow-up

Base: `a3ca472e6693942ea72f26a8c69f917ee166c1c4`. Local implementation only; deployment remains pending field approval.

## Change

The previous inline voice panel contained separate activity, confirmation and action containers, expanding the page and duplicating cancellation. Voice now starts directly from the user's gesture in one native modal dialog. Mobile/short viewports use a sheet above the navigation; desktop uses a centered dialog. The page keeps its height and scroll position. Review uses one editable field, send/retry actions and exactly one Cancel. Stop retains recognition results; Cancel discards them. Existing bilingual activity announcements and reduced-motion behavior remain.

Final results previously deduplicated only by result index. The existing transcript merge helper now also removes repeated/cumulative final text across indexes while preserving intentional repeated words within a sentence.

## Validation

- Client `npm run test:all`: 490 passed, 0 failed.
- Client `npm run build`: passed (TypeScript, Vite and PWA).
- `node scripts/receipt46-browser.mjs`: 41 browser cases passed; details in `browser-report.json`.
- All six regions, Korean/English and NOW/PLAN covered. Synthetic speech verifies explicit review/edit/send, duplicate blocking, retry/cancel, errors, permission denial, unsupported browsers, navigation cleanup and conversation continuity through recommendations/detail/actions/follow-up.
- Korean/English screenshots: 360×800, 390×700, 390×844, 844×390, desktop 1200×900, and 195×422 CSS viewport representing 200% reflow from 390×844.
- Browser assertions verify one dialog/Cancel, unchanged body/main height and scroll position, no horizontal overflow, navigation clearance, 44px action targets, reduced motion and repeated final results at three indexes.
- Keyboard geometry uses a synthetic VisualViewport resize; viewport unit tests also cover offsets and partial navigation intersection. Dialog bounds follow the visible viewport and CSS includes safe-area bottom padding.

## Field validation still required

These runs use synthetic SpeechRecognition and keyboard viewport fixtures, not a real microphone, iOS Safari or an actual mobile keyboard. Verify real Chrome and iPhone Safari microphone permission/start/stop, editing with keyboard open, dynamic browser chrome, safe-area behavior, screenreader announcements and subsequent questions before deployment. Narrow CSS viewport checks do not replace real-device zoom testing.

No Server code changed. No push, production deployment, DB/environment or Docker actions were performed. Existing candidate 8091 and production 8090 were not changed.
