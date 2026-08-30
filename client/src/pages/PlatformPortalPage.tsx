import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../platform.css';
import ExkoRegionKnowledgeLink from '../components/ExkoRegionKnowledgeLink';
import NationwideRegionExplorer from '../components/NationwideRegionExplorer';
import PortalRegionSearch from '../components/PortalRegionSearch';

const journeyStages = [
  { stage: 'PLAN', korean: '여행 전', copy: '부모님과 합천 하루 여행하고 싶어요.' },
  { stage: 'NOW', korean: '여행 중', copy: '지금 오후 4시고 여기까지 봤어요.' },
  { stage: 'RE-PLAN', korean: '상황 변화', copy: '비가 오고 어머니가 좀 힘들어하세요.' },
  { stage: 'ACTION', korean: '바로 이동', copy: '그럼 가까운 곳부터 갈게. 길찾기 해줘.' },
];

const regions = [
  { name: '합천 AI', detail: '합천의 여행 계획부터 현장 길찾기까지', status: '운영 중', to: '/hapcheon', cta: '합천 AI 시작하기', exkoRegionId:'hapcheon' },
  { name: '거창 AI', detail: '거창 가조 실증 지역에서 AI 여행안내를 이용해 보세요.', status: '현장 시험 중', to: '/gajo', cta: '거창 AI 시작하기', exkoRegionId:'geochang' },
  { name: '옥천 AI', detail: '옥천의 문학·문화·자연 여행을 AI와 준비해 보세요.', status: '현장 시험 중', to: '/okcheon', cta: '옥천 AI 시작하기', exkoRegionId:'okcheon' },
];

const entrances = [
  { id: 'traveler', kind: '여행자', title: 'AI 여행 시작하기', copy: 'AI와 여행을 계획하고 현장에서 추천·주변 찾기·혜택·여행기록을 이용하세요.', to: '/regions' },
  { id: 'partner', kind: '지역 업소', title: 'AI 관광 파트너 참여하기', copy: 'AI가 관광객과 우리 업소를 연결합니다. 업소를 등록하고 지역 AI 관광 파트너가 되어보세요.', to: '/partner/apply' },
  { id: 'municipality', kind: '지자체·관광기관', title: '우리 지역 AI 도입하기', copy: '지역 관광자원과 소상공인을 AI로 연결하는 지역형 관광 플랫폼을 직접 체험하고 도입해 보세요.', to: '/region/apply' },
];

const differenceQuestions = [
  { question: 'T맵이나 카카오맵과 무엇이 다른가요?', answer: '지도는 장소를 찾고 경로를 비교해 내비게이션으로 이동하는 데 강합니다. EXKOVIA는 그 기능을 대신하지 않습니다. 현재 위치와 현지시간, 날씨, 여행 상태를 함께 살핀 뒤 여러 후보와 이유를 제시하고 지도·길찾기로 연결합니다.' },
  { question: 'ChatGPT에 여행 일정을 물으면 되지 않나요?', answer: '범용 AI는 질문과 일반 지식에 답하는 데 강합니다. EXKOVIA는 지역의 확인된 정보와 지금까지의 일정·방문 장소·저장 장소를 이어 보며 PLAN → NOW → RE-PLAN → ACTION 흐름이 여행 중 끊기지 않도록 돕습니다.' },
  { question: '지자체 관광 홈페이지와 무엇이 다른가요?', answer: '관광 홈페이지의 신뢰할 수 있는 지역 정보를 다시 만드는 대신, 여행자의 지금 상황에 맞는 후보로 연결합니다. 역사·문화·자연 정보는 출처와 상태를 구분하고 실제 이동·전화·내 여행 저장 같은 다음 행동으로 이어갑니다.' },
  { question: '여행 중 위치·날씨·시간이 바뀌면 무엇을 해주나요?', answer: '확인된 현재 위치와 현지시간, 날씨, 남은 여행 상태를 다시 반영해 다음 순서를 제안합니다. 확인되지 않은 GPS 방문이나 영업 여부를 실제 사실처럼 말하지 않고 현장 확인이 필요한 정보는 분명히 표시합니다.' },
  { question: '지역 업소는 혜택이나 광고비 없이도 참여할 수 있나요?', answer: '혜택·할인·파트너 여부는 추천 순위를 사는 수단이 아닙니다. 관련성과 거리, 여행 맥락을 바탕으로 여러 후보와 선택 이유를 보여주며 특정 업소 한 곳을 근거 없이 정답처럼 단정하지 않습니다.' },
  { question: '지자체는 기존 관광 데이터를 다시 만들어야 하나요?', answer: '기존 관광 데이터와 안정적인 식별자를 우선 연결하고, 출처·검토 상태를 보존하는 방식으로 확장합니다. 같은 장소를 중복 생성하지 않으며 부족한 정보만 단계적으로 보완할 수 있습니다.' },
];

export default function PlatformPortalPage() {
  const [openDifference,setOpenDifference]=useState(0);
  return <div className="platform-page platform-portal-page">
    <header className="platform-header">
      <Link to="/" className="platform-brand"><img src="/branding/exkovia-mark.svg" alt="EXKOVIA" /></Link>
      <span>지역과 여행자를 잇는 AI 관광 플랫폼</span>
    </header>

    <main className="platform-main platform-portal-main">
      <section className="platform-hero" aria-labelledby="platform-hero-title">
        <div className="platform-hero-copy">
          <p className="platform-kicker">REGIONAL AI TOURISM PLATFORM</p>
          <h1 id="platform-hero-title"><span>대한민국 어디서든,</span><span>그 지역을 가장 잘 아는 AI와 여행하세요</span></h1>
          <p className="platform-hero-lead">메뉴를 배우지 마세요.<br />그냥 지금 상황을 말씀하세요.</p>
          <div className="platform-hero-actions">
            <Link className="platform-primary-action" to="/regions">지역 AI 여행안내 시작하기</Link>
            <a className="platform-secondary-action" href="#why-exkovia">어떻게 다른가요?</a>
          </div>
        </div>

        <ol className="platform-journey" aria-label="EXKOVIA 여행 흐름">
          {journeyStages.map((item, index) => <li key={item.stage}>
            <div><span>{item.stage}<em>{item.korean}</em></span><small>{String(index + 1).padStart(2, '0')}</small></div>
            <p>“{item.copy}”</p>
          </li>)}
        </ol>
      </section>

      <section className="platform-section platform-regions" aria-labelledby="active-regions-title">
        <div className="platform-section-heading">
          <p className="platform-kicker">START IN A REGION</p>
          <h2 id="active-regions-title">지역 AI 여행안내를 시작하세요</h2>
          <p>현재 운영 중이거나 현장 시험 중인 지역을 선택해 바로 이용할 수 있습니다.</p>
        </div>
        <PortalRegionSearch />
        <div className="platform-region-grid">
          {regions.map(region => <article className="is-active" key={region.name}>
            <div><span>{region.status}</span><h3>{region.name}</h3><p>{region.detail}</p></div>
            <div className="platform-region-actions">
              <a className="platform-region-primary" href={region.to}>{region.cta} <span aria-hidden="true">→</span></a>
              <ExkoRegionKnowledgeLink regionId={region.exkoRegionId} compact/>
            </div>
          </article>)}
        </div>
      </section>

      <NationwideRegionExplorer />

      <section className="platform-section platform-audiences" aria-labelledby="audiences-title">
        <div className="platform-section-heading">
          <p className="platform-kicker">THREE WAYS IN</p>
          <h2 id="audiences-title">누구나 자신의 목적에서 시작합니다</h2>
        </div>
        <div className="platform-entrances" aria-label="EXKOVIA 시작하기">
          {entrances.map(item => <article id={item.id} key={item.kind}>
            <small>{item.kind}</small><h3>{item.title}</h3><p>{item.copy}</p>
            <Link className="platform-cta" to={item.to}>{item.title}<span aria-hidden="true">→</span></Link>
          </article>)}
        </div>
      </section>

      <section id="why-exkovia" className="platform-section platform-difference" aria-labelledby="difference-title">
        <div className="platform-section-heading">
          <p className="platform-kicker">WHY EXKOVIA</p>
          <h2 id="difference-title">좋은 도구가 이미 있는데,<br />왜 하나 더 필요할까요?</h2>
          <p>지도와 범용 AI, 지역 관광정보가 잘하는 일을 존중하면서 여행자의 현재를 다음 행동까지 잇습니다.</p>
        </div>
        <div className="platform-accordion-grid">
          {differenceQuestions.map((item,index)=>{const open=openDifference===index,id=`difference-answer-${index}`;return <article className={open?'is-open':''} key={item.question}>
            <h3><button type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpenDifference(open?-1:index)}><span>{item.question}</span><i aria-hidden="true">{open?'−':'+'}</i></button></h3>
            <div id={id} hidden={!open}><p>{item.answer}</p></div>
          </article>})}
        </div>
        <div className="platform-lifecycle" aria-label="EXKOVIA 여행 연결 흐름">
          {journeyStages.map((step, index) => <span key={step.stage}>{step.stage}<small>{step.korean}</small>{index < 3 && <i aria-hidden="true">→</i>}</span>)}
        </div>
      </section>
    </main>
  </div>;
}
