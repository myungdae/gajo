import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { askGuide } from './guideClient';
import { trackPortal, type PortalEvent } from './portalAnalytics';
import './portal.css';

const regions = [
  { id: 'gajo', name: '거창 / 가조', shortName: '거창', tag: '산과 온천, 자연 속 쉼', use: '처음 온 가족 여행부터 지금 필요한 다음 장소까지', preview: '현재 운영 중인 지역 AI 여행안내로 연결됩니다.' },
  { id: 'hapcheon', name: '합천', shortName: '합천', tag: '호수와 산, 깊은 문화의 시간', use: '합천호·해인사 등 실제 구성된 지역 맥락으로 여행 이어가기', preview: '대표 목적지는 현재 검증된 지역 설정을 기준으로 안내합니다.' },
  { id: 'okcheon', name: '옥천', shortName: '옥천', tag: '문학과 전통문화가 흐르는 고장', use: '첫 방문부터 여행 중 달라진 상황까지 함께 판단하기', preview: '정지용 생가·문학관 등 승인된 문화 맥락을 활용합니다.' },
] as const;

const questions = [
  '지역 AI 여행안내를 한마디로 설명하면 무엇인가요?',
  'ChatGPT·Gemini와 무엇이 다른가요?',
  '그런데 ChatGPT에 여행 일정 짜달라고 하면 되지 않나요?',
  '지도·내비게이션과 무엇이 다른가요?',
  '저는 T맵을 많이 쓰는데, T맵과 뭐가 다른가요?',
  '정보는 믿을 수 있나요?',
  '지역정보는 누가 책임지고 관리하나요?',
  '민간 운영으로 시작할 수 있나요?',
  '업체가 돈을 내면 먼저 추천되나요?',
];

const talkExamples = ['부모님과 왔는데 두 시간 정도 어디 가지?', '비가 오는데 일정 다시 짜줘.', '화장실부터 찾아줘.', '전기차 충전하고 다음에 어디 가지?', '너무 더운데 어머니가 쉴 곳 없을까?'];

function jumpToRegions() { document.querySelector('#regions')?.scrollIntoView({ behavior: 'smooth' }); }

function GuideAnswer({ question, event }: { question: string; event?: PortalEvent }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (!next) return;
    trackPortal(event ?? 'portal_faq_opened', { question });
    if (answer) return;
    try { setAnswer((await askGuide(question)).answer); }
    catch { setError('안내를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'); }
  };
  return <article className={`portal-accordion ${open ? 'is-open' : ''}`}>
    <h3><button type="button" aria-expanded={open} onClick={() => void toggle()}><span>{question}</span><span aria-hidden="true">{open ? '−' : '+'}</span></button></h3>
    {open && <div className="accordion-answer" aria-live="polite">{answer ? answer.split('\n\n').map((text) => <p key={text}>{text}</p>) : <p>{error || '승인된 안내를 불러오는 중입니다…'}</p>}</div>}
  </article>;
}

function Portal() {
  return <div className="portal-shell">
    <header className="portal-nav"><a className="brand" href="/portal.html" aria-label="지역 AI 여행안내 포털 홈"><span>R</span>지역 AI 여행안내</a><button onClick={jumpToRegions}>지역 선택</button></header>
    <main>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">지역 AI 여행안내</p><h1 id="hero-title">대한민국 어디서든,<br/>그 지역을 가장 잘 아는 AI와 여행하세요</h1><p className="hero-lead">메뉴를 배우지 마세요.<br/>그냥 지금 상황을 말씀하세요.</p><div className="hero-actions"><button className="primary hero-primary" onClick={jumpToRegions}>지역 AI 여행안내 시작하기</button><a href="#difference">어떻게 다른가요?</a></div><nav className="hero-fast-lane" aria-label="바로 여행 시작하기"><strong>바로 여행 시작하기</strong><div>{regions.map((region)=><a key={region.id} href={`/${region.id}`} onClick={()=>{trackPortal('portal_region_selected',{region:region.id,source:'hero_fast_lane'});trackPortal('portal_concierge_started',{region:region.id,source:'hero_fast_lane'})}}>{region.shortName} AI <span aria-hidden="true">→</span></a>)}</div></nav><small>확인 가능한 위치·시간·날씨와 방문자가 알려준 여행 상황을 바탕으로 다음 선택을 돕습니다.</small></div><div className="hero-visual" aria-label="계획부터 행동까지 이어지는 여행의 흐름">{[['PLAN','부모님과 옥천 하루 여행하고 싶어요.'],['NOW','지금 오후 4시고 여기까지 봤어요.'],['RE-PLAN','비가 오고 어머니가 좀 힘들어하세요.'],['ACTION','그럼 가까운 곳부터 갈게. 길찾기 해줘.']].map(([step,example],index)=><div className="journey-step" key={step}><span>{step}</span><p>“{example}”</p>{index<3&&<i aria-hidden="true">↓</i>}</div>)}</div></section>

      <section className="section neighbor-section"><div className="neighbor-mark" aria-hidden="true">R</div><div><p className="eyebrow">EASY LOCAL KNOWLEDGE</p><h2>그 지역을 구석구석 잘 아는<br/><em>‘AI 동네박사’</em>처럼</h2><p>관광지만 알려주는 AI가 아닙니다. 맛집과 카페는 물론 주차장, 화장실, 충전소, 쉼터처럼 여행 중 실제로 필요한 지역의 사정까지 연결합니다.</p><p>그리고 지금 어디에 있는지, 누구와 함께인지, 시간이 얼마나 남았는지를 바탕으로 지금 무엇을 하는 것이 좋은지 함께 판단합니다.</p><small>이처럼 지역 현장에서 실제로 필요한 구체적인 지식을 하이퍼로컬 지식(Hyper-local Knowledge)이라고 합니다.</small></div></section>

      <section className="section first-difference"><div className="section-heading"><p className="eyebrow">WHY IS THIS DIFFERENT?</p><h2>여행지를 검색하는 것과<br/>무엇이 다른가요?</h2><p>관광지와 맛집을 찾아주는 데서 끝나지 않습니다. 지금 어디에 있는지, 누구와 여행하는지, 시간이 얼마나 남았는지와 여행 중 달라진 상황을 이어서 이해합니다. 상황이 달라지면 여행도 다시 판단합니다.</p></div><div className="situation-strip"><span>“엄마가 많이 못 걸으셔.”</span><span>“화장실부터 가야 해.”</span><span>“비가 오는데 한 시간밖에 없어.”</span></div></section>

      <section id="regions" className="section region-section"><div className="section-heading"><p className="eyebrow">CHOOSE YOUR REGION</p><h2>어느 지역을 여행하고 계세요?</h2><p>여행할 지역을 선택하면 그 지역의 AI 여행도우미가 바로 여행을 도와드립니다.</p></div><div className="region-grid">{regions.map((region, index) => <article className="region-card" key={region.id}><span className="region-index">0{index + 1}</span><p>{region.tag}</p><h3>{region.name}</h3><p>{region.use}</p><small>{region.preview}</small><a href={`/${region.id}`} onClick={() => { trackPortal('portal_region_selected', { region: region.id }); trackPortal('portal_concierge_started', { region: region.id }); }}>{region.shortName} AI 만나기 <span aria-hidden="true">→</span></a></article>)}</div></section>

      <section id="difference" className="section contrast-section"><div className="section-heading light"><p className="eyebrow">WHY AI TRAVEL GUIDE?</p><h2>좋은 도구가 이미 있는데,<br/>왜 하나 더 필요할까요?</h2></div><div className="objection-grid"><div><p className="layer-label">MAP / NAVIGATION LAYER</p><GuideAnswer question="저는 T맵을 많이 쓰는데, T맵과 뭐가 다른가요?" event="portal_tmap_objection_opened"/><strong>차이는 주변에서 무엇을 찾을 수 있느냐가 아니라,<br/>지금 나에게 무엇이 필요한지를 누가 판단하느냐입니다.</strong></div><div><p className="layer-label">DECISION / JOURNEY ORCHESTRATION</p><GuideAnswer question="그런데 ChatGPT에 여행 일정 짜달라고 하면 되지 않나요?" event="portal_chatgpt_objection_opened"/><strong>ChatGPT와 경쟁하는 것이 아니라,<br/>그 뛰어난 AI를 지역의 검증된 현실 속에서 계속 일하게 만듭니다.</strong></div></div></section>

      <section className="section talk-section"><div className="section-heading"><p className="eyebrow">JUST TALK</p><h2>여행의 말은 메뉴처럼<br/>정리되어 있지 않으니까요.</h2></div><div className="speech-list">{talkExamples.map((text, i) => <blockquote key={text} className={i % 2 ? 'offset' : ''}>“{text}”</blockquote>)}</div><button className="text-action talk-cta" onClick={jumpToRegions}>지역을 고르고 직접 말해보기 <span aria-hidden="true">→</span></button></section>

      <section className="section system-section"><div className="section-heading"><p className="eyebrow">HOW IT CONNECTS</p><h2>말 한마디가 다음 행동이 되기까지</h2></div><div className="system-flow" aria-label="여행객의 말에서 행동까지"><span>여행객의 말</span><i>→</i><span>지금의 상황</span><i>→</i><span>검증된 지역정보</span><i>→</i><span>지역에 맞는 판단</span><i>→</i><span>안전한 행동</span></div><p className="scope-note">지역별 제공 범위는 다릅니다. 운영 행동에는 검증·자격을 갖춘 데이터만 사용합니다.</p><div className="scope-grid">{['관광지','음식점 / 카페','숙박','축제','주차장','공중화장실','주유소','EV 충전소','관광안내','무더위쉼터 / 공공안전시설'].map(x=><span key={x}>{x}</span>)}</div></section>

      <section className="section trust-section"><div className="section-heading"><p className="eyebrow">TRUST & GOVERNANCE</p><h2>지역정보는 누가 책임지고 관리하나요?</h2><p>공식 근거와 현장지식이 곧바로 안내가 되는 것은 아닙니다. 검토와 사람의 승인을 거쳐 여행자에게 제공할 지역정보에 반영합니다.</p></div><div className="trust-flow"><span>공공·지자체<br/>공식정보</span><b>+</b><span>지역정보를 관리하는 운영자<br/><small>Regional Manager</small></span><b>→</b><span>지역정보 검토를 돕는 AI<br/><small>Regional Copilot</small></span><b>→</b><span>사람의 승인</span><b>→</b><span>검증된 지역정보</span><b>→</b><span>여행자를 돕는<br/>지역 AI 여행안내</span></div><p className="disclaimer">전문 운영 환경에서는 승인된 정보가 지역 데이터 관리 시스템(RDM)에 반영됩니다. 특정 지자체가 현재 공식 참여 중이라는 뜻은 아닙니다.</p></section>

      <section className="section safety-section"><div className="safety-card"><p className="eyebrow">BEYOND TOURISM</p><h2>관광 안내를 넘어,<br/>지역의 안전과 연결됩니다.</h2><div className="safety-scenes"><div><small>여행객</small><p>“너무 더워요. 어머니가 잠깐 쉬실 곳 없을까요?”</p><span>정보가 있을 때 검증된 공공안전 시설을 우선 안내합니다.</span></div><div><small>지자체·지역 운영자</small><p>“주요 관광동선 중 무더위쉼터 정보가 부족한 곳은?”</p><span>지역정보 검토를 돕는 AI가 DATA_INSUFFICIENT · COVERAGE_GAP_CANDIDATE로 검토를 지원합니다.</span></div></div><p>관광객에게는 필요한 공공시설을 안내하고, 지역에는 확인이 필요한 인프라 사각지대를 보여줄 수 있습니다. 정책을 자율 결정하지 않습니다.</p></div></section>

      <section className="section municipal-section"><div className="section-heading"><p className="eyebrow">VALUE FOR THE REGION</p><h2>지역에는 무엇이 달라지나요?</h2><p>여행 안내 하나를 더 만드는 것이 아니라, 흩어진 지역정보가 필요한 순간에 제대로 쓰이도록 연결합니다.</p></div><div className="municipal-grid"><article><small>여행객</small><h3>필요한 순간에</h3><p>지역의 실제 장소와 서비스, 공공시설로 이어질 수 있습니다.</p></article><article><small>지역 업체</small><h3>적절한 순간에</h3><p>여행자의 필요와 맞을 때 발견되고 연결될 기회를 얻습니다. 유료 우선 노출을 뜻하지 않습니다.</p></article><article><small>지자체</small><h3>살아 있는 지역 서비스로</h3><p>흩어진 관광·음식·교통·주차·편의·안전정보를 검토 가능한 하나의 흐름으로 연결할 수 있습니다.</p></article></div></section>

      <section className="section audience-section"><div className="section-heading"><p className="eyebrow">FOUR WAYS IN</p><h2>지역을 찾는 사람부터<br/>지역을 운영하는 사람까지</h2></div><div className="audience-grid">{[['여행객','우리 지역 AI 만나기'],['지역 업체','우리 가게를 지역 AI와 연결하기'],['지자체·관광기관','우리 지역 지역 AI 여행안내 도입하기'],['Regional Manager / 지역 운영자','지역정보 운영에 참여하기']].map(([title,cta],index)=><article className={index===0?'audience-primary':'audience-professional'} key={title}><small>{title}</small><h3>{cta}</h3><button onClick={()=>index===0?jumpToRegions():trackPortal('portal_audience_selected',{audience:title})}>{index===0?'지역 선택하기':'Phase 1 안내 보기'} →</button></article>)}</div></section>

      <section className="section faq-section"><div className="section-heading"><p className="eyebrow">APPROVED GUIDE KNOWLEDGE</p><h2>자주 묻는 질문</h2><p>답변은 별도 문구가 아니라 기존 읽기 전용 Guide Knowledge에서 불러옵니다.</p></div><div className="faq-list">{questions.map(q=><GuideAnswer key={q} question={q}/>)}</div></section>
    </main>
    <footer><div><strong>지역 AI 여행안내</strong><p>발견하고, 이해하고, 지역을 선택하는 입구.</p></div><button className="primary" onClick={jumpToRegions}>지역 선택하기</button></footer>
  </div>;
}

createRoot(document.getElementById('portal-root')!).render(<StrictMode><Portal /></StrictMode>);
