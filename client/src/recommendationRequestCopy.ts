export const RECOMMENDATION_REQUEST_COPY = {
  ko: {
    automatic: '현재 상황으로 다시 추천받기',
    automaticHelp: '현재 위치·시간·날씨와 여행 상황을 반영해 다시 추천해 드립니다.',
    automaticRequest: '현재 위치·시간·날씨와 여행 상황을 반영해 다시 추천해 주세요.',
    checking: '현재 상황을 확인하고 있어요…',
    unavailable: '현재 상황을 확인하지 못했어요. 다시 시도하거나 직접 요청해 주세요.',
    directTitle: '추가로 원하는 것이 있으신가요?',
    voice: '말로 요청하기',
    text: '글자로 요청하기',
    inputLabel: '원하는 조건 입력',
  },
  en: {
    automatic: 'Update Recommendations',
    automaticHelp: 'We’ll use your current location, time, weather and trip context to recommend again.',
    automaticRequest: 'Please update the recommendations using my current location, time, weather and trip context.',
    checking: 'Checking current conditions…',
    unavailable: 'We couldn’t check current conditions. Try again or make a request.',
    directTitle: 'Anything else you’d like?',
    voice: 'Speak a Request',
    text: 'Type a Request',
    inputLabel: 'Your preferences',
  },
} as const;
