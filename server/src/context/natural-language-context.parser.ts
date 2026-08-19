import type { TransportMode, WalkingLevel } from './runtime-context.types';

export interface ParsedNaturalLanguageContext {
  conditions: string[];
  companions: { age?: number; relationship: 'mother' | 'father' | 'parent'; healthConditions: string[] }[];
  transportMode?: TransportMode;
  stayUntil?: string;
  walkingLevel?: WalkingLevel;
  companionConstraints: string[];
  activityPreferences: string[];
  explicitAccommodation?: string;
  wellnessGoal?: string;
  weather?: string;
  congestion?: string;
}

function parseTransport(message: string): TransportMode | undefined {
  if (/차를\s*(?:가지고|끌고)\s*(?:가|오)/.test(message)) return 'CAR';
  if (/(?:자동차|자가용|승용차)(?:로|으로)\s*(?:이동|왔|와|가|방문)/.test(message) || /(?:^|[\s,.!?])차로\s*(?:이동|왔|와|가|방문)/.test(message)) return 'CAR';
  if (/(?:대중교통|버스)(?:으로|로)\s*(?:이동|왔|와|가|방문)/.test(message)) return 'PUBLIC_TRANSPORT';
  if (/(?:도보로|걸어서)\s*(?:이동|왔|와|가|방문)?/.test(message) || /걸어\s*(?:갈|가|다닐)/.test(message)) return 'WALK';
  return undefined;
}

function parseStayUntil(message: string): string | undefined {
  const returnMatch=message.match(/(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:쯤)?\s*(?:돌아가|떠나|출발)/);if(returnMatch){let hour=Number(returnMatch[2]);if(returnMatch[1]==='오후'&&hour<12)hour+=12;if(returnMatch[1]==='오전'&&hour===12)hour=0;return`${String(hour).padStart(2,'0')}:00`}
  const match = message.match(/(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?\s*(?:까지|에(?:는)?\s*(?:가야|떠나야|출발해야))/);
  if (!match) return undefined;
  let hour = Number(match[2]);
  const minute = Number(match[3] || 0);
  if (hour > 23 || minute > 59) return undefined;
  if (match[1] === '오후' && hour < 12) hour += 12;
  if (match[1] === '오전' && hour === 12) hour = 0;
  if (!match[1] && hour >= 1 && hour <= 7) hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseNaturalLanguageContext(message: string): ParsedNaturalLanguageContext {
  const conditions: string[] = [];
  if (/무릎/.test(message)) conditions.push('kneePain');
  if (/피로|피곤/.test(message)) conditions.push('fatigue');
  if (/고혈압/.test(message)) conditions.push('hypertensionConcern');
  if (/거동|보행\s*불편|신체/.test(message)) conditions.push('limitedMobility');

  const companions = [...message.matchAll(/(\d{1,3})\s*세\s*(어머니|엄마|아버지|아빠|부모님)(?=과|와|랑|하고|을|를|께서|이|가|\s|$)/g)].map(match => ({
    age: Number(match[1]),
    relationship: (/어머니|엄마/.test(match[2]) ? 'mother' : /아버지|아빠/.test(match[2]) ? 'father' : 'parent') as 'mother' | 'father' | 'parent',
    healthConditions: [] as string[],
  }));
  if(companions.length===0&&/부모님(?:과|와|랑|하고|을|를|이|가|께서|\s|$)/.test(message))companions.push({age:undefined as any,relationship:'parent',healthConditions:[]});
  const comfort = /편안한\s*일정|무리(?:하지|가\s*되지)\s*않는\s*일정|여유롭게/.test(message);
  const shortWalking = /짧게\s*걷|짧은\s*보행|걷는\s*(?:거리|시간)(?:가|를)?\s*짧|많이\s*걷(?:지는|지)\s*않|많이\s*걷기는\s*힘들/.test(message);
  const companionConstraints: string[] = [];
  if (companions.some(item => item.age >= 65)) companionConstraints.push('elderlyCompanion');
  if (shortWalking || (/무릎/.test(message) && comfort)) companionConstraints.push('shortWalkingDistance');

  const activityPreferences:string[]=[];
  if(/온천(?:은|을|도)?\s*(?:꼭|반드시)?\s*(?:하고|가고|이용하고)?\s*싶/.test(message)) activityPreferences.push('HOT_SPRING');
  if(/편안한\s*일정|무리(?:하지|가\s*되지)\s*않는\s*일정|여유롭게|쉬고\s*싶/.test(message)) activityPreferences.push('REST_AND_RECOVERY');
  if(/카페(?:에|도)?\s*(?:가고)?\s*싶|카페(?:에서|에)\s*(?:쉬|휴식)/.test(message)) activityPreferences.push('CAFE');
  if(/맛집|맛있(?:는|게|는\s*것)|밥\s*먹|(?:점심|저녁|아침)(?:을|를)?\s*먹|식사/.test(message)) activityPreferences.push('FOOD');
  if(/합천호|호수\s*주변/.test(message)) activityPreferences.push('HAPCHEON_LAKE','NATURE');
  if(/둘러보|풍경|드라이브/.test(message)) activityPreferences.push('NATURE');
  if(/(?:하루|1박|2박|묵고|숙박)/.test(message)) activityPreferences.push('ACCOMMODATION');
  if(/은행동|중앙로|대흥동|으능정이|도심\s*문화/.test(message)) activityPreferences.push('URBAN_CULTURE');
  if(/중앙시장|전통시장|시장\s*(?:쪽|을|보다|구경)/.test(message)) activityPreferences.push('TRADITIONAL_MARKET');
  if(/공연|전시|문화예술/.test(message)) activityPreferences.push('PERFORMANCE_EXHIBITION');
  if(/쇼핑/.test(message)) activityPreferences.push('SHOPPING');

  return {
    conditions, companions, companionConstraints,
    activityPreferences:[...new Set(activityPreferences)],
    explicitAccommodation:/(?:합천호\s*)?스마일\s*펜션/.test(message)?'합천호 스마일펜션':undefined,
    transportMode: parseTransport(message),
    stayUntil: parseStayUntil(message),
    walkingLevel: shortWalking || (/무릎/.test(message) && comfort) ? 'LOW' : undefined,
    wellnessGoal: comfort || /휴식|회복/.test(message) ? 'restAndRecovery' : /어머니|엄마|아버지|아빠|부모님|가족/.test(message) ? 'familyHealingTrip' : /스트레스/.test(message) ? 'stressRelief' : undefined,
    weather: /비\s*(?:가|는)?\s*(?:옴|와|내려|오는)|우천|장마/.test(message) ? 'rainyWeather' : /맑|화창/.test(message) ? 'clearWeather' : undefined,
    congestion: /사람이?\s*많|붐빔/.test(message) ? 'highCongestion' : /한산|여유/.test(message) ? 'lowCongestion' : undefined,
  };
}
