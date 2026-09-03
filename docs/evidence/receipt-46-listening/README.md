# Receipt 46 follow-up — visible listening activity

Status: local follow-up complete; receipt 46 candidate/field verification remains open. No production deployment approval is implied.

Base: 1d52d4c99a548c32a977134be7dc37121a386dd1.
The three prior commits are preserved unchanged.

## Change

- A persistent atomic polite live region displays the current voice state.
- Waiting uses a neutral dashed outline; listening uses a rounded teal emphasis and a steady microphone halo; recognition completion uses a blue check and squared outline.
- Listening copy: “듣고 있어요. 말씀해 주세요.” / “Listening. Please speak.”
- Stop Listening (듣기 중지) ends recognition and proceeds to review. Cancel (취소) continues to discard the voice draft.
- The halo is decorative, driven only by LISTENING state, and does not measure or visualize audio volume.
- Reduced-motion preference stops the animation and keeps a static ring and the full status message.
- Recognized text remains editable and requires explicit confirmation; no changes to recognition, API request or conversation persistence logic.

## Validation

- Client full test suite: 486 passed, 0 failed, 0 skipped.
- Production build: passed, including PWA output.
- Browser fixture: 49 passed cases in actual Chrome, using synthetic SpeechRecognition and intercepted local API responses.
- Prior 39 bilingual regional conversation checks retained; added 10 ko/en listening-state checks covering 360×800, 390×700, 390×844, 844×390 and 195×422 (200% equivalent CSS reflow).
- Verified active animation with no-preference and stopped animation with prefers-reduced-motion: reduce, unchanged state text, distinct phase shapes/colors, polite atomic announcements, stop-to-review, and no horizontal overflow.
- Existing review layout and 44px target/bottom-navigation checks retained.
- Active listening screenshots were visually reviewed at portrait, landscape and 200% equivalent reflow sizes.
- No Server changes. No new skip/only/todo tests.
- Browser report and screenshots are in this folder; previous receipt-46 evidence is unchanged.

## Field status

The user confirmed real Chrome microphone recognition and editing worked for “안녕하세요 지금 테스트 중입니다” before this visual follow-up.
The new pulse and state styling have been validated with synthetic recognition only; actual candidate-device visual/microphone revalidation is still required.
Synthetic testing does not replace a real microphone check or iPhone Safari/Android Chrome native behavior checks.

No push, production deployment, DB, environment-variable or Docker changes were performed.

Reproduce with an isolated local Client on port 5176 and dedicated Chrome debugging on port 9226:
node scripts/receipt46-browser.mjs --activity
The fixture uses a dedicated tab and clears local test-origin browser storage.
