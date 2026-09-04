export const REQUEST_PRESENTATION_COPY = {
  ko: { title:'무엇을 도와드릴까요?', help:'가고 싶은 곳이나 지금 필요한 것을 편하게 말씀해 주세요.', voice:'다른 요청 말하기', text:'다른 요청 입력하기', processing:'말씀하신 내용을 바탕으로 찾고 있어요.', cancel:'닫기', send:'요청 보내기' },
  en: { title:'How can I help?', help:'Tell me where you’d like to go or what you need right now.', voice:'Say Another Request', text:'Type Another Request', processing:'Finding options based on your request.', cancel:'Close', send:'Send Request' },
} as const;
export function requestPresentation(hasResult:boolean, loading:boolean, textOpen:boolean, voiceOpen:boolean) {
  return { intro:!hasResult&&!loading&&!textOpen&&!voiceOpen, followup:hasResult&&!loading&&!textOpen&&!voiceOpen, text:textOpen&&!loading&&!voiceOpen, voice:voiceOpen&&!loading };
}
export function shouldOfferContextRefresh(result:unknown, locationNeedsReview:boolean) {
  return locationNeedsReview || (result as {replanningRecommended?:boolean}|undefined)?.replanningRecommended === true;
}
