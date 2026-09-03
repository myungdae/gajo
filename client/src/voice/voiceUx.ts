export type VoiceUxState =
  | "IDLE" | "REQUESTING_PERMISSION" | "LISTENING" | "TRANSCRIBING"
  | "UNDERSTANDING" | "CONFIRMING" | "EXECUTING" | "RECOVERABLE_ERROR"
  | "PERMISSION_DENIED" | "UNSUPPORTED";

export type VoiceSlotName = "place" | "action" | "category" | "referenceLocation" | "constraints";
export type SlotConfidence = "HIGH" | "MEDIUM" | "LOW";
export interface VoiceSlot { value: string; confidence: SlotConfidence }
export interface VoiceUnderstanding {
  transcript: string;
  slots: Record<VoiceSlotName, VoiceSlot>;
  placeAmbiguous?: boolean;
  regionRelationship?: "KNOWN" | "UNCLEAR";
}
export type VoiceConfirmationReason = "LOW_CONFIDENCE" | "PLACE_AMBIGUOUS" | "REGION_UNCLEAR" | "RISKY_ACTION" | "USER_REQUESTED_EDIT";
export interface VoiceConfirmationDecision { mode:"AUTO_EXECUTE"|"CONFIRM";slots:VoiceSlotName[];reasons:VoiceConfirmationReason[] }
export interface VoiceResultFingerprint { fingerprint:string;at:number }

const categoryRules: Array<[RegExp, string]> = [
  [/식당|맛집|밥|음식/, "음식점"], [/카페|커피/, "카페"], [/숙소|숙박|호텔|펜션/, "숙박"],
  [/관광|볼\s*곳|명소/, "관광지"], [/날씨|추워|더워|비\s*와/, "날씨"],
];
const actionRules: Array<[RegExp, string]> = [
  [/일정에?\s*(담아|넣어|추가)/, "일정에 담기"], [/일정에서?\s*(빼|삭제)/, "일정에서 삭제"],
  [/예약/, "예약하기"], [/전화/, "전화하기"], [/(길\s*안내|내비|네비).*(시작|해\s*줘)|길\s*안내/, "길 안내 시작"], [/몇\s*시|영업|운영|마감/, "운영시간 확인"],
  [/추워|더워|날씨|비\s*와/, "현재 날씨 확인"], [/주변|근처|가까운/, "주변 장소 찾기"],
  [/찾아|추천/, "장소 찾기"], [/안내|알려|정보|어떤\s*곳/, "장소 정보 보기"],
];

const cleanPlace = (text: string) => text
  .replace(/주변|근처|가까운|식당|맛집|음식점|카페|커피|관광지|숙소|숙박|호텔|펜션/g, " ")
  .replace(/찾아\s*줘|찾아줘|찾아|추천해?\s*줘|추천|일정에?\s*(담아|넣어|추가)\s*줘?|일정에서?\s*(빼|삭제)\s*줘?|예약해?\s*줘?|전화해?\s*줘?|길\s*안내(?:를)?\s*(시작해?\s*줘?|해\s*줘)?|몇\s*시까지\s*해|몇\s*시|지금|추워|더워|날씨|정보를?|알려\s*줘|볼까|할까/g, " ")
  .replace(/[?.!,。？！]/g, " ").replace(/\s+/g, " ").trim();

export function understandVoice(text: string, referenceLocation = "현재 위치"): VoiceUnderstanding {
  const transcript = text.trim().replace(/\s+/g, " ");
  const category = categoryRules.find(([pattern]) => pattern.test(transcript))?.[1] || "";
  const action = actionRules.find(([pattern]) => pattern.test(transcript))?.[1] || "";
  const effectiveCategory=category||(action==="운영시간 확인"?"장소 운영정보":action==="장소 정보 보기"?"장소 정보":/일정에 담기|일정에서 삭제/.test(action)?"여행 장소":/예약하기|전화하기|길 안내 시작/.test(action)?"장소 실행":"");
  const place = cleanPlace(transcript);
  const constraints = [
    /도보|걸어서/.test(transcript) ? "도보" : "",
    /차로|자동차/.test(transcript) ? "자동차" : "",
    /아이|어린이/.test(transcript) ? "어린이 동행" : "",
    /어르신|부모님|엄마|아버지/.test(transcript) ? "어르신 동행" : "",
    /비\s*와|비오는|비 오는/.test(transcript) ? "비" : "",
  ].filter(Boolean).join(", ");
  return { transcript, slots: {
    place: { value: place, confidence: place.length >= 2 ? "HIGH" : "LOW" },
    action: { value: action, confidence: action ? "HIGH" : "LOW" },
    category: { value: effectiveCategory, confidence: effectiveCategory ? "HIGH" : "LOW" },
    referenceLocation: { value: /주변|근처/.test(transcript) && place ? `${place} 주변` : referenceLocation, confidence: "HIGH" },
    constraints: { value: constraints, confidence: constraints ? "HIGH" : "MEDIUM" },
  }};
}

export function updateVoiceSlot(model: VoiceUnderstanding, slot: VoiceSlotName, value: string): VoiceUnderstanding {
  return { ...model, slots: { ...model.slots, [slot]: { value: value.trim(), confidence: value.trim() ? "HIGH" : "LOW" } } };
}

export function voiceNeedsConfirmation(model: VoiceUnderstanding): VoiceSlotName[] {
  return voiceConfirmationPolicy(model).slots;
}

const riskyAction=/일정에 담기|일정에서 삭제|예약하기|전화하기|길 안내 시작/;
export function voiceConfirmationPolicy(model:VoiceUnderstanding,options:{userRequestedEdit?:boolean}={}):VoiceConfirmationDecision{
  const required=(['place','action','category'] as VoiceSlotName[]),slots=required.filter(name=>model.slots[name].confidence!=="HIGH"),reasons:VoiceConfirmationReason[]=[];
  if(slots.length)reasons.push("LOW_CONFIDENCE");
  if(model.placeAmbiguous){if(!slots.includes("place"))slots.push("place");reasons.push("PLACE_AMBIGUOUS")}
  if(model.regionRelationship==="UNCLEAR"){if(!slots.includes("referenceLocation"))slots.push("referenceLocation");reasons.push("REGION_UNCLEAR")}
  if(riskyAction.test(model.slots.action.value))reasons.push("RISKY_ACTION");
  if(options.userRequestedEdit){reasons.push("USER_REQUESTED_EDIT");for(const name of required)if(!slots.includes(name))slots.push(name)}
  return{mode:reasons.length?"CONFIRM":"AUTO_EXECUTE",slots,reasons};
}
export function acceptVoiceResult(previous:VoiceResultFingerprint|null,text:string,now:number,inFlight:boolean):{accepted:boolean;next:VoiceResultFingerprint}{
  const fingerprint=text.trim().replace(/\s+/g," ").toLowerCase(),duplicate=previous?.fingerprint===fingerprint&&(inFlight||now-previous.at<1500);
  return{accepted:Boolean(fingerprint)&&!inFlight&&!duplicate,next:{fingerprint,at:now}};
}

export function voiceExecutionText(model: VoiceUnderstanding): string {
  const { place, action, category, constraints } = model.slots;
  const categoryNeeded=category.value&&(!action.value||/주변 장소 찾기|장소 찾기/.test(action.value));
  return [place.value, action.value, categoryNeeded?category.value:"",constraints.value].filter(Boolean).join(" ").trim() || model.transcript;
}

export const voiceStateMessage = (state: VoiceUxState) => ({
  IDLE: "말하거나 글자로 입력할 수 있어요.", REQUESTING_PERMISSION: "마이크 사용을 확인하고 있어요.",
  LISTENING: "듣고 있어요.", TRANSCRIBING: "말씀을 글로 옮기고 있어요.", UNDERSTANDING: "요청을 이해하고 있어요.",
  CONFIRMING: "이렇게 이해했어요.", EXECUTING: "확인한 요청을 실행하고 있어요.",
  RECOVERABLE_ERROR: "잘 듣지 못했어요. 확인된 내용은 그대로 두고 다시 말하거나 글자로 고칠 수 있어요.",
  PERMISSION_DENIED: "마이크 권한이 없어도 글자와 버튼으로 계속할 수 있어요.",
  UNSUPPORTED: "이 브라우저에서는 음성을 사용할 수 없어 글자로 입력할 수 있어요.",
}[state]);
