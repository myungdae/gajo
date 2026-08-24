import { GuideService } from './guide.service';
import { GUIDE_KNOWLEDGE } from './guide-knowledge';
describe('public Concierge Guide Copilot', () => {
  const landingFaqs = [
    '지역 AI 컨시어지를 한마디로 설명하면 무엇인가요?',
    '여행 중에는 실제로 무엇을 해주나요?',
    '여행 계획이 갑자기 바뀌어도 되나요?',
    'ChatGPT·Gemini와 무엇이 다른가요?',
    '지도·내비게이션과 무엇이 다른가요?',
    '지역정보는 누가 책임지고 관리하나요?',
    '실제 여행에서는 어떻게 다른가요?',
    '앞에서 한 이야기도 기억하나요?',
    '추천만 해주나요? 바로 갈 수도 있나요?',
    '업체가 돈을 내면 먼저 추천되나요?',
    '지역 업체에는 어떤 도움이 되나요?',
    '지자체에는 어떤 도움이 되나요?',
  ];
  it.each(landingFaqs)('keeps visible landing FAQ %s on approved knowledge', (question) => {
    const answer: any = new GuideService().answer({ question }, `landing-${question}`);
    expect(answer.status).toBe('ANSWERED');
    expect(answer.intent).toBeDefined();
    expect(answer.candidate).toBeUndefined();
    expect(answer.answer).not.toMatch(/아직 승인된 안내 지식|검토가 필요한 질문/);
  });
  it.each([
    '지도·내비게이션과 무엇이 다른가요?',
    '지도와 무엇이 다른가요?',
    '내비게이션과 무엇이 다른가요?',
    '네이버 지도랑 뭐가 달라요?',
    '카카오맵이 있는데 왜 필요해요?',
    '구글 지도가 있는데 왜 필요해요?',
  ])('routes map/navigation regression %s to MAP_DIFFERENCE', (question) => {
    const answer: any = new GuideService().answer({ question }, `map-${question}`);
    expect(answer).toMatchObject({ status: 'ANSWERED', intent: 'MAP_DIFFERENCE' });
    expect(answer.answer).toMatch(/어떻게 갈 것인가.*현재 상황에서 어디로 가는 것이 좋은가.*지도·내비게이션으로 연결/s);
  });
  it('keeps governance and actual-trip landing answers detailed', () => {
    const service = new GuideService();
    expect(service.answer({ question: landingFaqs[5] }, 'landing-governance')).toMatchObject({
      intent: 'HYPERLOCAL_DATA_GOVERNANCE',
      answer: expect.stringMatching(/지자체·공공기관.*민간 Regional Manager.*Regional Copilot 검토.*사람 승인.*RDM 반영.*Local Concierge 사용/s),
    });
    expect(service.answer({ question: landingFaqs[6] }, 'landing-trip')).toMatchObject({
      intent: 'ACTUAL_TRIP_DIFFERENCE',
      answer: expect.stringMatching(/70대 어머니.*비 오는 날 오후 4시.*옥천.*고정된 실시간 일정 예시가 아니라/s),
    });
  });
  it.each(['EXKO가 뭐예요?', '일반 검색과 관계 기반 AI가 뭐가 다른가요?'])(
    'explains the internal semantic layer safely for %s',
    (question) => {
      const answer: any = new GuideService().answer(
        { question, audience: 'GENERAL' },
        'exko-explanation',
      );
      expect(answer.answer).toContain('관계 기반 AI');
      expect(answer.answer).toContain('내부 플랫폼 계층');
      expect(answer.answer).toContain('운영정보');
      expect(answer.answer).not.toContain('공개 제품');
    },
  );
  it('answers Okcheon status without claiming public production completion', () => {
    const answer: any = new GuideService().answer(
      { question: '옥천에서도 되나요?' },
      'okcheon-status',
    );
    expect(answer).toMatchObject({
      status: 'ANSWERED',
      intent: 'OKCHEON_STATUS',
      readOnly: true,
    });
    expect(answer.answer).toMatch(/공통 엔진.*옥천.*온보딩/s);
    expect(answer.answer).toMatch(/완전한 운영 서비스라고 주장하지는 않습니다/);
  });
  it('distinguishes usable onboarding from field readiness for the Phase 3 wording', () =>
    expect(
      new GuideService().answer(
        { question: '옥천도 지금 쓸 수 있나요?' },
        'okcheon-now',
      ),
    ).toMatchObject({
      intent: 'OKCHEON_STATUS',
      answer: expect.stringMatching(
        /기본 연결은 구현.*현장 검증은 계속 필요.*완전한 운영 서비스라고 주장하지는 않습니다/s,
      ),
    }));
  it('reports the Phase 5 semantic layer separately from operational verification', () => {
    const answer: any = new GuideService().answer(
      { question: '옥천은 어느 정도 준비됐나요?' },
      'okcheon-readiness',
    );
    expect(answer.intent).toBe('OKCHEON_STATUS');
    expect(answer.answer).toMatch(
      /EXKO 의미 관계.*작동.*현장 검증.*관리자 확인 준비 단계/s,
    );
    expect(answer.answer).not.toContain('FIELD-DEMO READY');
  });
  const golden: [string, string][] = [
    ['ChatGPT하고 뭐가 다른가요?', 'CHATGPT_DIFFERENCE'],
    ['구글이 있는데 왜 필요해요?', 'MAP_DIFFERENCE'],
    ['네이버 지도면 되지 않나요?', 'MAP_DIFFERENCE'],
    ['그냥 검색하면 되잖아요.', 'SEARCH_CONTINUITY'],
    ['AI 정보가 틀리면요?', 'DATA_ACCURACY'],
    ['정보는 믿을 수 있나요?', 'DATA_ACCURACY'],
    ['민간 운영으로 시작할 수 있나요?', 'PRIVATE_REGIONAL_OPERATION'],
    ['누가 지역정보를 관리하나요?', 'HYPERLOCAL_DATA_GOVERNANCE'],
    ['돈 내는 업체를 먼저 추천하나요?', 'PAID_RANKING'],
    ['업체가 참여하면 뭐가 좋아요?', 'BUSINESS_VALUE'],
    ['지자체가 꼭 해야 하나요?', 'MUNICIPALITY_VALUE'],
    ['합천에서만 되나요?', 'REGIONAL_SCALE'],
    ['내 위치는 어떻게 사용하나요?', 'PRIVACY_LOCATION'],
    ['여행을 닫았다 다시 열면 어떻게 되나요?', 'PRIVACY_LOCATION'],
    ['구글도 요즘 AI 추천하는데요?', 'MAP_OBJECTION'],
    ['ChatGPT한테 위치 알려주면 똑같지 않나요?', 'MAP_OBJECTION'],
    ['이거 홈페이지인가요?', 'WEBSITE_OR_MOBILE'],
    ['그냥 웹사이트 아닌가요?', 'WEBSITE_OR_MOBILE'],
    ['PC에서도 되나요?', 'WEBSITE_OR_MOBILE'],
    ['휴대폰에 어떻게 넣나요?', 'PHONE_ACCESS'],
    ['설치해야 하나요?', 'PHONE_ACCESS'],
    ['앱인가요?', 'APP_EXPERIENCE'],
    ['앱스토어에서 받을 수 있나요?', 'STORE_AVAILABILITY'],
    ['PWA가 뭐예요?', 'PWA_EXPLANATION'],
    ['TWA가 뭐예요?', 'TWA_EXPLANATION'],
    ['정보 수정은 어떻게 하나요?', 'INFORMATION_CORRECTION'],
    ['잘못된 정보는 어떻게 고치나요?', 'INFORMATION_CORRECTION'],
    ['우리 업체 전화번호가 바뀌었어요.', 'INFORMATION_CORRECTION'],
    ['업체가 직접 수정할 수 있나요?', 'INFORMATION_CORRECTION'],
    ['수정하면 바로 반영되나요?', 'INFORMATION_CORRECTION'],
    ['누가 최종 승인하나요?', 'INFORMATION_CORRECTION'],
    ['왜 바로 수정하면 안 되나요?', 'INFORMATION_CORRECTION'],
    ['관광객이 틀린 정보를 발견하면 어떻게 하나요?', 'INFORMATION_CORRECTION'],
    ['지자체 입장에서 누가 지역정보를 관리하나요?', 'HYPERLOCAL_DATA_GOVERNANCE'],
  ];

  it.each([
    '정보는 믿을 수 있나요?',
    '이 정보 믿어도 돼요?',
    '정확한 정보인가요?',
    'AI가 틀리면 어떻게 해요?',
  ])('answers information-trust question %s without perfect-accuracy claims',(question)=>{
    const answer:any=new GuideService().answer({question},`trust-${question}`);
    expect(answer).toMatchObject({status:'ANSWERED',intent:'DATA_ACCURACY',readOnly:true});
    expect(answer.answer).toMatch(/인터넷 검색.*AI.*자동으로 운영 사실.*공식 데이터.*지역 현장정보.*Regional Copilot.*사람 운영자.*Evidence.*Review.*Human approval.*Operational Data.*Concierge Action/s);
    expect(answer.answer).toMatch(/영업시간.*휴무.*가격.*행사.*영구히 정확하다고 보장할 수 없습니다/s);
    expect(answer.answer).not.toMatch(/100% 정확|완벽하게 정확|오류가 없습니다/);
    expect(answer.relatedQuestions).toEqual(expect.arrayContaining(['지역정보는 누가 책임지고 관리하나요?','틀린 정보는 누가 고치나요?']));
  });

  it.each([
    '민간 운영으로 시작할 수 있나요?',
    '지자체 없이도 할 수 있나요?',
    '민간이 운영해도 되나요?',
    '꼭 군청이 해야 하나요?',
  ])('answers private-operation question %s without claiming a current contract',(question)=>{
    const answer:any=new GuideService().answer({question},`private-${question}`);
    expect(answer).toMatchObject({status:'ANSWERED',intent:'PRIVATE_REGIONAL_OPERATION',readOnly:true});
    expect(answer.answer).toMatch(/지자체 참여가 필수는 아닙니다.*지역 관광조직.*협회.*상인조직.*지역 크리에이터.*전문 민간 운영자/s);
    expect(answer.answer).toMatch(/공식 공공 근거.*민간 지역 현장지식.*Regional Copilot.*사람의 검증/s);
    expect(answer.answer).not.toMatch(/이미 계약|계약해 운영 중입니다|운영 계약을 체결/);
    expect(answer.relatedQuestions).toEqual(expect.arrayContaining(['지자체가 꼭 해야 하나요?','Regional Manager는 무슨 일을 하나요?']));
  });
  it.each(golden)('%s resolves to approved %s knowledge', (question, intent) =>
    expect(new GuideService().answer({ question }, question)).toMatchObject({
      status: 'ANSWERED',
      intent,
      readOnly: true,
    }),
  );
  it.each([
    '지역정보는 누가 책임지고 관리하나요?',
    '이 지역정보는 누가 관리해요?',
    '정보가 맞는지는 누가 확인하나요?',
    '지역 데이터는 누가 책임지나요?',
    '구글에서 그냥 가져오는 정보 아닌가요?',
    '하이퍼로컬 정보는 누가 업데이트하나요?',
    '지역 데이터는 누가 관리해요?',
    '이 정보가 맞는지는 누가 확인하나요?',
    '지자체가 관리하나요?',
    '민간이 관리하나요?',
    '지역정보는 누가 책임져요?',
    '하이퍼로컬 데이터는 누가 업데이트하나요?',
    '지자체와 민간이 같이 관리하나요?',
  ])('routes governance variant %s to the approved intent', (question) => {
    const answer: any = new GuideService().answer({ question }, `governance-${question}`);
    expect(answer).toMatchObject({ status: 'ANSWERED', intent: 'HYPERLOCAL_DATA_GOVERNANCE', readOnly: true });
    expect(answer.answer).toMatch(/검색엔진.*지속적으로 확인하고 관리/s);
  });
  it.each([
    '지역정보는 누가 책임지고 관리하나요?',
    '지자체와 민간이 같이 관리하나요?',
    '구글에서 그냥 가져오는 정보 아닌가요?',
  ])('keeps the full trust model for %s', (question) => {
    const answer: any = new GuideService().answer({ question }, `trust-depth-${question}`);
    expect(answer).toMatchObject({ intent: 'HYPERLOCAL_DATA_GOVERNANCE' });
    expect(answer.answer).toMatch(/지자체·공공기관.*권위 있는 근거/s);
    expect(answer.answer).toMatch(/민간 Regional Manager.*지역 관광조직·협회·상인조직·지역 운영자/s);
    expect(answer.answer).toMatch(/Regional Copilot 검토.*사람 승인/s);
    expect(answer.answer).toMatch(/EVIDENCE.*자동으로 검증된 운영 사실이 아닙니다/s);
    expect(answer.answer).toMatch(/지자체 참여는 필수가 아니며/);
    expect(answer.answer).not.toMatch(/모든 지자체가 (?:참여|운영)|모든 정보가 항상 정확합니다|구글.*(?:신뢰할 수 없|부정확)|업체 주장은 자동으로 검증됩니다|방문자 제보는 자동으로 검증됩니다/s);
  });
  it('explains cooperative governance and the full verification flow without overclaiming', () => {
    const answer: any = new GuideService().answer(
      { question: '지역정보는 누가 책임지고 관리하나요?' },
      'governance-boundary',
    );
    expect(answer.answer).toMatch(/공식 공공정보.*지역 현장정보.*사람의 검증/s);
    expect(answer.answer).toMatch(/지자체.*공영주차장.*민간 Regional Manager/s);
    expect(answer.answer).toMatch(/지자체 참여는 필수가 아니며/);
    expect(answer.answer).toMatch(/정보 발견.*근거 확인.*Regional Copilot 검토.*사람 승인.*RDM 반영.*Local Concierge 사용/s);
    expect(answer.answer).toMatch(/검색 결과.*AI.*업체 주장.*방문자 제보.*EVIDENCE.*자동으로 검증된 운영 사실이 아닙니다/s);
    expect(answer.answer).not.toMatch(/모든 정보는 (?:항상|언제나) 정확합니다|지자체와 협약했습니다|지자체 참여가 필수입니다/);
  });
  it('links trust and stewardship knowledge to the governance question', () => {
    for (const intent of ['DATA_ACCURACY', 'DATA_STEWARDSHIP']) {
      const knowledge = GUIDE_KNOWLEDGE.find((entry) => entry.intent === intent)!;
      expect(knowledge.relatedQuestions).toContain('지역정보는 누가 책임지고 관리하나요?');
    }
  });
  it('adapts perspective without requiring role selection', () => {
    expect(
      new GuideService().answer(
        { question: '업체가 참여하면 뭐가 좋아요?' },
        'b',
      ),
    ).toMatchObject({
      audience: 'BUSINESS',
      answer: expect.stringContaining('업체 입장에서'),
    });
    expect(
      new GuideService().answer({ question: '지자체가 꼭 해야 하나요?' }, 'p'),
    ).toMatchObject({
      audience: 'PUBLIC_SECTOR',
      answer: expect.stringContaining('공공 관점'),
    });
  });
  it('handles a Google follow-up without repeating or denying Google recommendation', () => {
    const service = new GuideService(),
      first: any = service.answer({ question: '구글이 있잖아요.' }, 'f'),
      next: any = service.answer(
        {
          question: '그래도 구글도 추천해주잖아요.',
          previousIntent: first.intent,
        },
        'f',
      );
    expect(next).toMatchObject({ intent: 'MAP_OBJECTION' });
    expect(next.answer).toMatch(/맞습니다.*추천/);
    expect(next.answer).not.toBe(first.answer);
  });
  it('keeps the homepage to phone to store follow-up accurate and non-repetitive', () => {
    const service = new GuideService(),
      web: any = service.answer({ question: '이거 홈페이지인가요?' }, 'flow'),
      phone: any = service.answer(
        { question: '그럼 내가 어떻게 가져요?', previousIntent: web.intent },
        'flow',
      ),
      store: any = service.answer(
        { question: '앱스토어에는 없어요?', previousIntent: phone.intent },
        'flow',
      );
    expect(web).toMatchObject({
      intent: 'WEBSITE_OR_MOBILE',
      answer: expect.stringMatching(/웹에서 열리기.*PC.*휴대폰/s),
    });
    expect(phone).toMatchObject({
      intent: 'PHONE_ACCESS',
      answer: expect.stringMatching(/QR코드.*링크.*홈 화면에 추가/s),
    });
    expect(store).toMatchObject({
      intent: 'STORE_AVAILABILITY',
      answer: expect.stringMatching(
        /현재 앱스토어에 공개된 앱은 아닙니다.*현재.*구현되어 있지 않습니다/s,
      ),
    });
    expect(new Set([web.answer, phone.answer, store.answer]).size).toBe(3);
  });
  it('keeps public answers experiential first and technical terms opt-in', () => {
    const service = new GuideService(),
      web: any = service.answer({ question: '홈페이지예요?' }, 'plain'),
      phone: any = service.answer(
        { question: '내 휴대폰에 어떻게 넣어요?' },
        'plain2',
      ),
      pwa: any = service.answer({ question: 'PWA가 뭐예요?' }, 'tech');
    expect(web.answer).not.toMatch(/PWA|TWA|service worker|manifest/i);
    expect(phone.answer).not.toMatch(/TWA|service worker|manifest/i);
    expect(pwa.answer).toMatch(/Progressive Web App.*홈 화면/s);
  });
  it('states that store packaging is future and not currently implemented', () => {
    const service = new GuideService(),
      store: any = service.answer(
        { question: '앱스토어에서도 받을 수 있나요?' },
        'store',
      ),
      twa: any = service.answer({ question: 'TWA가 뭐예요?' }, 'twa');
    expect(store.answer).toMatch(/현재 앱스토어에 공개된 앱은 아닙니다/);
    expect(store.answer).not.toMatch(
      /현재 (?:Google Play|앱스토어)에서 다운로드/,
    );
    expect(twa.answer).toMatch(
      /Android.*현재 TWA 패키징이 구현되어 있지 않으며/s,
    );
    expect(twa.answer).not.toMatch(/iOS|App Store/);
  });
  it('uses dedicated business and public-sector homepage explanations', () => {
    const service = new GuideService(),
      business: any = service.answer(
        { question: '홈페이지랑 뭐가 달라요?', audience: 'BUSINESS' },
        'biz',
      ),
      publicSector: any = service.answer(
        { question: '홈페이지랑 뭐가 달라요?', audience: 'PUBLIC_SECTOR' },
        'public',
      );
    expect(business.answer).toMatch(
      /단순한 업체 목록.*검증된 업체.*길찾기·전화·예약/s,
    );
    expect(business.answer).not.toMatch(/결제.*(?:보장|우선)/);
    expect(publicSector.answer).toMatch(
      /QR이나 링크.*앱스토어 설치를 먼저 요구하지 않고.*Regional Manager/s,
    );
  });
  it('explains the current correction boundary before future submission options', () => {
    const answer: any = new GuideService().answer(
      { question: '정보 수정은 어떻게 하나요?' },
      'correction',
    );
    expect(answer).toMatchObject({
      intent: 'INFORMATION_CORRECTION',
      readOnly: true,
      answer: expect.stringMatching(
        /아무나 바로.*Regional Copilot.*지역 운영자.*VERIFIED\/ACTIVE.*공개 정보 오류 신고 버튼이 없고.*셀프서비스 포털도 구현되어 있지 않습니다.*향후/s,
      ),
    });
    expect(answer.answer).not.toMatch(
      /신고 버튼을 누르|업체 계정으로 로그인|자동.*승인|바로 반영/,
    );
  });
  it('adapts correction guidance for visitors businesses and public-sector managers', () => {
    const service = new GuideService(),
      visitor: any = service.answer(
        { question: '관광객이 틀린 정보를 발견하면 어떻게 하나요?' },
        'visitor-correction',
      ),
      business: any = service.answer(
        { question: '우리 업체 전화번호가 바뀌었어요.' },
        'business-correction',
      ),
      publicSector: any = service.answer(
        { question: '지자체 입장에서 누가 지역정보를 관리하나요?' },
        'public-correction',
      );
    expect(visitor).toMatchObject({
      audience: 'VISITOR',
      answer: expect.stringMatching(
        /공개 오류 신고 버튼이 구현되어 있지 않습니다.*향후/s,
      ),
    });
    expect(business).toMatchObject({
      audience: 'BUSINESS',
      answer: expect.stringMatching(
        /셀프서비스 포털이 없으며.*근거 확인·승인.*향후/s,
      ),
    });
    expect(publicSector).toMatchObject({
      audience: 'PUBLIC_SECTOR',
      intent: 'HYPERLOCAL_DATA_GOVERNANCE',
      answer: expect.stringMatching(
        /Regional Manager.*Regional Copilot 검토.*권한 있는 지역 운영자의 사람 승인/s,
      ),
    });
  });
  it('keeps correction related questions on the review and human-approval path', () => {
    const service = new GuideService(),
      direct: any = service.answer(
        { question: '업체가 직접 수정할 수 있나요?' },
        'direct',
      ),
      immediate: any = service.answer(
        { question: '수정하면 바로 반영되나요?' },
        'immediate',
      ),
      final: any = service.answer(
        { question: '누가 최종 승인하나요?' },
        'final',
      ),
      why: any = service.answer(
        { question: '왜 바로 수정하면 안 되나요?' },
        'why',
      );
    for (const answer of [direct, immediate, final, why])
      expect(answer).toMatchObject({
        intent: 'INFORMATION_CORRECTION',
        readOnly: true,
      });
    expect(direct.answer).toMatch(/직접.*셀프서비스 포털이 없으며/);
    expect(immediate.answer).toMatch(/근거.*승인.*반영/s);
    expect(final.answer).toMatch(/지역 운영자.*최종 반영 여부/);
    expect(why.answer).toMatch(/실제 행동에 연결.*즉시 사실로 취급하지 않는/s);
  });
  it('keeps every approved answer free of prohibited marketing claims', () => {
    const answers = GUIDE_KNOWLEDGE.map((x) => x.shortAnswer).join(' ');
    for (const claim of [
      '세계 최초',
      '100% 정확',
      '매출 보장',
      'ChatGPT는 여행 추천을 못한다',
      'Google은 추천을 못한다',
    ])
      expect(answers).not.toContain(claim);
  });
  it.each([
    ['한마디로 뭐예요?', 'CONCIERGE_ONE_LINE'],
    ['여행 중에는 실제로 무엇을 해주나요?', 'DURING_TRIP_ASSISTANCE'],
    ['여행 계획이 갑자기 바뀌어도 되나요?', 'RUNTIME_REPLANNING'],
    ['앞에서 한 이야기도 기억하나요?', 'TRIP_CONTINUITY'],
    ['추천만 해주나요?', 'RECOMMENDATION_TO_ACTION'],
    ['앞으로 어디까지 발전할 수 있나요?', 'FUTURE_VISION'],
  ])('routes visitor question %s to %s', (question, intent) =>
    expect(new GuideService().answer({ question }, question)).toMatchObject({ intent, readOnly: true }),
  );
  it('keeps current, future, memory, and action boundaries explicit', () => {
    const service = new GuideService();
    expect(service.answer({ question: '여행할 때 뭘 해줘요?' }, 'during')).toMatchObject({ answer: expect.stringMatching(/센서가 자동으로 안다는 뜻은 아닙니다/) });
    expect(service.answer({ question: '앞에서 한 이야기도 기억하나요?' }, 'memory')).toMatchObject({ answer: expect.stringMatching(/모든 대화를 무기한 기억하는 것은 아니며/) });
    expect(service.answer({ question: '길찾기도 되나요?' }, 'action')).toMatchObject({ answer: expect.stringMatching(/모든 장소에 모든 버튼이 있는 것은 아니며/) });
    expect(service.answer({ question: '앞으로 어디까지 발전할 수 있나요?' }, 'future')).toMatchObject({ answer: expect.stringMatching(/현재는.*앞으로의 가능성.*현재 로봇이 운영 중이라는 뜻은 아닙니다/s) });
  });
  it('explains a shared engine with region-isolated data and journeys', () => {
    const result: any = new GuideService().answer({ question: '합천 가조 옥천 정보가 서로 섞이지 않나요?' }, 'regions');
    expect(result).toMatchObject({ intent: 'REGIONAL_SCALE' });
    expect(result.answer).toMatch(/같은 Regional Engine.*지역별로 분리.*서로 섞이지 않도록/s);
  });
  it('returns a non-persisted human-review candidate for unknown field questions', () =>
    expect(
      new GuideService().answer(
        { question: '우리 동네만의 새 질문입니다' },
        'u',
      ),
    ).toMatchObject({
      status: 'REVIEW_CANDIDATE',
      candidate: {
        type: 'NEW_GUIDE_QUESTION',
        questionStored: false,
        requiresHumanApproval: true,
      },
    }));
  it('rate limits the public endpoint per client without authentication', () => {
    const service = new GuideService();
    for (let i = 0; i < 20; i++)
      service.answer({ question: '무슨 서비스인가요?' }, 'same');
    expect(() =>
      service.answer({ question: '무슨 서비스인가요?' }, 'same'),
    ).toThrow('Guide request limit exceeded');
  });
});
