export interface ContextSummaryRow {
  key: 'requested' | 'companion' | 'walking' | 'transport' | 'stay' | 'style';
  icon: string;
  label: string;
  value: string;
}
export function withRequestedDestinations(rows:ContextSummaryRow[],destinations:any[]=[]):ContextSummaryRow[]{const labels=destinations.map(item=>item.requestedLabel||item.label).filter(Boolean);return labels.length?[{key:'requested',icon:'📍',label:'꼭 가고 싶은 곳',value:labels.join(' · ')},...rows]:rows}

const localName = (value: unknown) => String(value || '').split(/[\/#:]/).pop() || '';
const unique = (values: Array<string | undefined>) => [...new Set(values.filter(Boolean) as string[])];

function formatCompanion(item: any): string {
  const relationship = ({ mother: '어머니', father: '아버지', parent: '부모님', parents: '부모님', spouse: '배우자', partner: '연인', couple: '연인', grandmother: '할머니', grandfather: '할아버지', child: '아이', children: '아이', friend: '친구', friends: '친구', family: '가족', alone: '혼자' } as Record<string, string>)[String(item?.relationship || '').toLowerCase()] || item?.relationship;
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
  const goalLabels: Record<string, string> = { restAndRecovery: '편안한 휴식', familyHealingTrip: '가족과 함께하는 힐링', seniorFriendlyTrip: '어르신과 편안한 여행', stressRelief: '스트레스 완화', HOT_SPRING:'온천', FOOD:'맛집', CAFE:'카페', NATURE:'자연·산책', TOURISM_NATURE:'자연·산책', INDOOR:'실내 활동', ACTIVITY:'체험', LITERATURE_CULTURE:'문학·문화', TRADITIONAL_CULTURE:'전통문화체험', DAECHEONG_LAKE:'대청호', LAKE:'대청호', REST_AND_RECOVERY:'편안한 휴식', REST:'편안한 휴식', LOTUS_ECOLOGY:'연꽃·생태', FAMILY_TRIP:'가족여행', MUDFLAT_COAST:'갯벌·해안', MILITARY_CULTURE_HISTORY:'군문화·역사', FESTIVAL_EVENT:'축제·행사', FAMILY_EXPERIENCE:'가족 체험', LOCAL_CONVENIENCE:'생활편의', HAPCHEON_LAKE:'합천호·호수', SCENIC_DRIVE:'드라이브', ACCOMMODATION:'숙박', URBAN_CULTURE:'도심문화', TRADITIONAL_MARKET:'전통시장', PERFORMANCE_EXHIBITION:'공연·전시', FAMILY_OUTING:'가족 나들이', WALKING:'산책', SHOPPING:'쇼핑' };
  const explicitInterests: unknown[] = context?.activityPreferences?.length ? context.activityPreferences : input.activityPreferences || [];
  const displayedGoals: unknown[] = explicitInterests.length ? explicitInterests : context?.wellnessGoals || input.wellnessGoals || [];
  const goals = unique(displayedGoals.map((goal: unknown) => goalLabels[localName(goal)]));
  return [
    companion ? { key: 'companion', icon: '👵', label: '동반', value: companion } : undefined,
    walkingFacts.length ? { key: 'walking', icon: '🚶', label: '보행', value: walkingFacts.join(' · ') } : undefined,
    transport ? { key: 'transport', icon: '🚗', label: '이동', value: transport } : undefined,
    stay ? { key: 'stay', icon: '🕔', label: '머무는 시간', value: stay } : undefined,
    goals.length ? { key: 'style', icon: '🌿', label: explicitInterests.length ? '관심' : '여행 방식', value: goals.join(' · ') } : undefined,
  ].filter(Boolean) as ContextSummaryRow[];
}
