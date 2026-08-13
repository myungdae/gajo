import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCommittedSpeech, renderSpeechText, SPEECH_RESTART_DELAY_MS } from '../src/utils/speechTranscript.ts';

test('exact final duplicate across restart', () => assert.equal(mergeCommittedSpeech('78세 어머니와 가조에 왔습니다', '78세 어머니와 가조에 왔습니다'), '78세 어머니와 가조에 왔습니다'));
test('new final containing old final appends only its new tail', () => assert.equal(mergeCommittedSpeech('78세 어머니와 가조에 왔습니다', '78세 어머니와 가조에 왔습니다 어머니는 무릎이 조금 불편합니다'), '78세 어머니와 가조에 왔습니다 어머니는 무릎이 조금 불편합니다'));
test('longest suffix-prefix overlap', () => assert.equal(mergeCommittedSpeech('자동차로 이동하고 오후 5시까지 머물 예정입니다', '오후 5시까지 머물 예정입니다 지금 상황에 맞게 추천해주세요'), '자동차로 이동하고 오후 5시까지 머물 예정입니다 지금 상황에 맞게 추천해주세요'));
test('genuinely new sentence appends normally', () => assert.equal(mergeCommittedSpeech('오후 5시까지 머물 예정입니다', '그리고 저녁도 먹고 싶어요'), '오후 5시까지 머물 예정입니다 그리고 저녁도 먹고 싶어요'));
test('legitimate repeated Korean words away from boundary remain', () => assert.equal(mergeCommittedSpeech('온천에 가고 싶어요', '그리고 카페도 가고 다시 온천에 가고 싶어요'), '온천에 가고 싶어요 그리고 카페도 가고 다시 온천에 가고 싶어요'));
test('interim to final transition renders once', () => assert.equal(renderSpeechText('', mergeCommittedSpeech('', '무릎이 불편합니다'), ''), '무릎이 불편합니다'));
test('manual stop merge does not duplicate remaining interim', () => assert.equal(mergeCommittedSpeech('오후 5시까지 머물 예정입니다', '머물 예정입니다'), '오후 5시까지 머물 예정입니다'));
test('typed base text remains intact', () => assert.equal(renderSpeechText('어머니와 왔어요', '많이 걷기 어려워요', ''), '어머니와 왔어요 많이 걷기 어려워요'));
test('placeholder never enters an empty base transcript', () => assert.equal(renderSpeechText('', '편안한 일정을 추천해 주세요', ''), '편안한 일정을 추천해 주세요'));
test('continuous restart remains enabled', () => assert.equal(SPEECH_RESTART_DELAY_MS, 250));
test('browser regression request appears once after restart replay', () => {
  const request = '78세 어머니와 가조에 왔습니다 어머니는 무릎이 조금 불편합니다 자동차로 이동하고 오후 5시까지 머물 예정입니다 지금 상황에 맞게 편안한 일정을 추천해 주세요.';
  assert.equal(mergeCommittedSpeech(mergeCommittedSpeech('', request), request), request);
});
