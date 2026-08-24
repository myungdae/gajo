export const GUIDE_GLOSSARY = [
  { term: 'Regional Copilot', aliases: ['지역 코파일럿'], definition: '지역 정보를 검토하기 쉽게 정리하고, 사람의 확인과 여행 안내를 돕는 지역형 AI 지원 도구입니다.' },
  { term: 'Regional Manager', aliases: ['지역 매니저'], definition: '지역의 현장 정보를 관리하고 필요한 내용을 확인·승인하는 권한 있는 운영 주체입니다.' },
  { term: 'Hyper-local Knowledge', aliases: ['초지역 지식'], definition: '영업 변화나 현장 사정처럼 작은 지역 단위에서 자주 바뀌는 구체적인 정보입니다.' },
  { term: 'Replanning', aliases: ['재계획'], definition: '날씨, 시간, 이동 부담 같은 변화에 맞춰 기존 여행 순서와 선택지를 다시 조정하는 일입니다.' },
  { term: 'Core Destination', aliases: ['핵심 방문지'], definition: '지역에서 대표 방문지 후보로 관리되는 장소입니다. 광고 순위나 무조건 추천을 뜻하지 않습니다.' },
  { term: 'RDM', aliases: [], definition: '지역 데이터 관리 화면입니다. 승인된 운영자가 지역 정보를 검토하고 관리할 때 사용합니다.' },
] as const;
export type GuideGlossaryEntry=(typeof GUIDE_GLOSSARY)[number];
