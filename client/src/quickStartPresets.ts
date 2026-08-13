import type { CreateContextInput } from './api/client';

export type QuickStartPresetId = 'senior' | 'family-healing' | 'indoor' | 'nearby';
export interface QuickStartPreset { id:QuickStartPresetId; emoji:string; title:string; entryMessage:string; destination:'/concierge'|'/nearby-discovery'; intakeValues:Record<string,string>; selectedPreferences:string[]; context:CreateContextInput }

/** Single source of truth for quick-start navigation, UI hydration, and runtime context. */
export const QUICK_START_PRESETS:Record<QuickStartPresetId,QuickStartPreset>={
  senior:{id:'senior',emoji:'👵',title:'어르신 동반 여행',destination:'/concierge',entryMessage:'어르신과 편안하게 여행하는 일정으로 시작했어요. 필요한 부분만 더 알려주세요.',intakeValues:{companion:'parents',walking:'LOW'},selectedPreferences:['REST_AND_RECOVERY'],context:{inputMode:'STRUCTURED',companions:[{relationship:'parent',healthConditions:[]}],walkingLevel:'LOW',companionConstraints:['shortWalkingDistance'],wellnessGoals:['restAndRecovery'],activityPreferences:['REST_AND_RECOVERY']}},
  'family-healing':{id:'family-healing',emoji:'👨‍👩‍👧‍👦',title:'가족 힐링 여행',destination:'/concierge',entryMessage:'가족과 여유롭게 즐기는 일정으로 시작했어요. 필요한 부분만 더 알려주세요.',intakeValues:{companion:'family'},selectedPreferences:['REST_AND_RECOVERY'],context:{inputMode:'STRUCTURED',companions:[{relationship:'family',healthConditions:[]}],wellnessGoals:['restAndRecovery'],activityPreferences:['REST_AND_RECOVERY']}},
  indoor:{id:'indoor',emoji:'🏠',title:'비 오는 날 실내 코스',destination:'/concierge',entryMessage:'실내 중심 일정으로 시작했어요. 현재 날씨도 함께 확인해 추천할게요.',intakeValues:{},selectedPreferences:['INDOOR'],context:{inputMode:'STRUCTURED',activityPreferences:['INDOOR']}},
  nearby:{id:'nearby',emoji:'📍',title:'주변 즐길거리 찾기',destination:'/nearby-discovery',entryMessage:'현재 위치를 기준으로 가까운 즐길거리를 찾아볼게요.',intakeValues:{},selectedPreferences:[],context:{inputMode:'STRUCTURED'}},
};
export function getQuickStartPreset(value:unknown){return typeof value==='string'?QUICK_START_PRESETS[value as QuickStartPresetId]:undefined}
