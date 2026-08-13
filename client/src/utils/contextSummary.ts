export interface ContextSummaryRow {
  key: 'companion' | 'walking' | 'transport' | 'stay' | 'style';
  icon: string;
  label: string;
  value: string;
}

const localName = (value: unknown) => String(value || '').split(/[\/#:]/).pop() || '';
const unique = (values: Array<string | undefined>) => [...new Set(values.filter(Boolean) as string[])];

function formatCompanion(item: any): string {
  const relationship = ({ mother: '어머니', father: '아버지', parent: '부모님', spouse: '배우자', grandmother: '할머니', grandfather: '할아버지', child: '아이', family: '가족' } as Record<string, string>)[String(item?.relationship || '').toLowerCase()] || item?.relationship;
  return [item?.age ? `${item.age}세` : '', relationship].filter(Boolean).join(' ');
}

function formatStayUntil(value: unknown): string | undefined {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value ? `${value}까지` : undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시${minute ? ` ${minute}분` : ''}까지`;
}

export function buildContextSummary(context: any): ContextSummaryRow[] {
  const input = context?.raw?.input || {};
  const companions: any[] = context?.companions || input.companions || [];
  const companion = companions.map(formatCompanion).filter(Boolean).join(', ');
  const conditions = [
    ...(context?.healthConditions || input.healthConditions || []), ...(context?.expandedConditions || []),
    ...(context?.companionConstraints || input.companionConstraints || []),
    ...companions.flatMap(item => item.healthConditions || []),
  ].map(localName);
  const walkingFacts = unique([
    conditions.includes('kneePain') ? '무릎 불편' : undefined,
    conditions.includes('shortWalkingDistance') ? '짧은 보행 고려' : undefined,
    conditions.includes('limitedMobility') ? '보행 부담 고려' : undefined,
    conditions.includes('fatigue') ? '피로 고려' : undefined,
    ({ LOW: '짧은 보행 고려', MODERATE: '보통 수준 보행', HIGH: '보행 활동 선호' } as Record<string, string>)[context?.walkingLevel || input.walkingLevel],
  ]);
  const transport = ({ CAR: '자동차', WALK: '도보', PUBLIC_TRANSPORT: '대중교통', PUBLIC_TRANSIT: '대중교통', TAXI: '택시' } as Record<string, string>)[context?.transportMode || input.transportMode];
  const stay = formatStayUntil(context?.stayUntil || input.stayUntil);
  const goalLabels: Record<string, string> = { restAndRecovery: '편안한 휴식', familyHealingTrip: '가족과 함께하는 힐링', seniorFriendlyTrip: '어르신과 편안한 여행', stressRelief: '스트레스 완화', HOT_SPRING:'온천', FOOD:'맛집', CAFE:'카페', NATURE:'자연·산책', INDOOR:'실내 활동', ACTIVITY:'체험' };
  const goals = unique([...(context?.wellnessGoals || input.wellnessGoals || []),...(context?.activityPreferences || input.activityPreferences || [])].map((goal: unknown) => goalLabels[localName(goal)]));
  return [
    companion ? { key: 'companion', icon: '👵', label: '동반', value: companion } : undefined,
    walkingFacts.length ? { key: 'walking', icon: '🚶', label: '보행', value: walkingFacts.join(' · ') } : undefined,
    transport ? { key: 'transport', icon: '🚗', label: '이동', value: transport } : undefined,
    stay ? { key: 'stay', icon: '🕔', label: '머무는 시간', value: stay } : undefined,
    goals.length ? { key: 'style', icon: '🌿', label: '여행 방식', value: goals.join(' · ') } : undefined,
  ].filter(Boolean) as ContextSummaryRow[];
}
