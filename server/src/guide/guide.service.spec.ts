import { GuideService } from './guide.service';
import { GUIDE_KNOWLEDGE } from './guide-knowledge';
describe('public Concierge Guide Copilot', () => {
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
    ['누가 지역정보를 관리하나요?', 'DATA_STEWARDSHIP'],
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
    ['지자체 입장에서 누가 지역정보를 관리하나요?', 'INFORMATION_CORRECTION'],
  ];
  it.each(golden)('%s resolves to approved %s knowledge', (question, intent) =>
    expect(new GuideService().answer({ question }, question)).toMatchObject({
      status: 'ANSWERED',
      intent,
      readOnly: true,
    }),
  );
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
      answer: expect.stringMatching(
        /Regional Copilot.*Regional Manager.*Copilot이 제안하고 사람이 결정/s,
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
