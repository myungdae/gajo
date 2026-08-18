import { REGION_CONFIGS, REGION_INTEREST_OPTIONS } from './regionConfig.ts';
import type { PlannedContext } from './tripSession.ts';

const companionLabels:Record<string,string>={parent:'부모님',spouse:'부부',child:'아이와',family:'가족'};
const transportLabels:Record<string,string>={CAR:'자동차',PUBLIC_TRANSPORT:'대중교통',PUBLIC_TRANSIT:'대중교통',WALK:'도보'};
const walkingLabels:Record<string,string>={LOW:'짧은 보행',MODERATE:'보통 걷기',HIGH:'걷기 여유'};

export function buildNowContinuation(planned?:PlannedContext){
  if(!planned)return undefined;
  const circumstances=[...new Set((planned.companions||[]).map(item=>companionLabels[item.relationship||'']).filter(Boolean))];
  const transport=planned.transportMode&&transportLabels[planned.transportMode];if(transport)circumstances.push(transport);
  const walking=planned.walkingLevel&&walkingLabels[planned.walkingLevel];if(walking)circumstances.push(walking);
  const interests=(planned.interests||[]).map(id=>REGION_INTEREST_OPTIONS.find(option=>option.id===id)?.label||Object.values(REGION_CONFIGS).flatMap(config=>config.interests).find(option=>option.id===id)?.label).filter(Boolean) as string[];
  return{circumstances,interests};
}
