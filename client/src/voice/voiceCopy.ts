import type { VoiceUxState } from './voiceUx.ts';
export const VOICE_COPY = {
  ko: {
    start:'말로 질문하기',stop:'말하기 끝',review:'인식된 문장을 확인해 주세요',transcript:'인식된 문장 · 직접 수정할 수 있어요',
    confirm:'이대로 보내기',again:'다시 말하기',cancel:'취소',text:'글자로 입력하기',sending:'전송 중…',
    privacy:'버튼을 누르면 마이크를 사용합니다. 앱은 녹음 파일을 저장하지 않으며, 확인한 문장만 질문으로 보냅니다.',
    permission:'마이크 권한이 거부되었습니다. 브라우저의 사이트 설정에서 마이크를 허용한 뒤 다시 시도하거나 글자로 입력해 주세요.',
    unsupported:'이 브라우저에서는 음성 입력을 지원하지 않습니다. 글자로 질문을 입력해 주세요.',
    error:'음성을 인식하지 못했습니다. 다시 말하거나 글자로 입력해 주세요.',
    empty:'말소리가 들리지 않았습니다. 다시 말하거나 글자로 입력해 주세요.',
    states:{IDLE:'말로 질문하기',REQUESTING_PERMISSION:'마이크 사용을 확인하고 있어요',LISTENING:'듣고 있어요',TRANSCRIBING:'인식 문장을 정리하고 있어요',UNDERSTANDING:'인식 문장을 확인하고 있어요',CONFIRMING:'인식 완료 · 확인 후 보내 주세요',EXECUTING:'전송 중…',RECOVERABLE_ERROR:'다시 말하거나 글자로 입력할 수 있어요',PERMISSION_DENIED:'마이크 권한이 거부되었습니다',UNSUPPORTED:'글자로 계속 질문할 수 있어요'},
  },
  en: {
    start:'Speak a Question',stop:'Finish Speaking',review:'Review your question',transcript:'Recognized text · you can edit it',
    confirm:'Send This Question',again:'Speak Again',cancel:'Cancel',text:'Type a Question',sending:'Sending…',
    privacy:'The microphone starts when you press the button. This app does not save audio recordings. Only the text you confirm is sent as your question.',
    permission:'Microphone permission was denied. Allow microphone access in your browser’s site settings and try again, or type your question.',
    unsupported:'Voice input is not supported in this browser. Please type your question.',
    error:'Speech could not be recognized. Try speaking again or type your question.',
    empty:'No speech was heard. Try speaking again or type your question.',
    states:{IDLE:'Speak a Question',REQUESTING_PERMISSION:'Checking microphone access',LISTENING:'Listening',TRANSCRIBING:'Preparing recognized text',UNDERSTANDING:'Checking recognized text',CONFIRMING:'Speech recognized · review before sending',EXECUTING:'Sending…',RECOVERABLE_ERROR:'Speak again or type your question',PERMISSION_DENIED:'Microphone permission denied',UNSUPPORTED:'You can continue by typing'},
  },
} as const;
export const localizedVoiceState = (state:VoiceUxState,locale:'ko'|'en') => VOICE_COPY[locale].states[state];
