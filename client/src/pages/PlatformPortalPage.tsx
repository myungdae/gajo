import { Link } from 'react-router-dom';
import '../platform.css';

const journeyStages = [
  { stage: 'PLAN', copy: '부모님과 합천 하루 여행하고 싶어요.' },
  { stage: 'NOW', copy: '지금 오후 4시고 여기까지 봤어요.' },
  { stage: 'RE-PLAN', copy: '비가 오고 어머니가 좀 힘들어하세요.' },
  { stage: 'ACTION', copy: '그럼 가까운 곳부터 갈게. 길찾기 해줘.' },
];

const regions = [
  { name: '합천 AI', detail: '합천의 여행 계획부터 현장 길찾기까지', status: '운영 중', to: '/hapcheon' },
  { name: '가조 AI', detail: '지역 정보와 여행 경험을 준비하고 있습니다.', status: '준비 중' },
  { name: '옥천 AI', detail: '지역 정보와 여행 경험을 준비하고 있습니다.', status: '준비 중' },
];

const entrances = [
  { id: 'traveler', kind: '여행자', title: 'AI 여행 시작하기', copy: 'AI와 여행을 계획하고 현장에서 추천·주변 찾기·혜택·여행기록을 이용하세요.', to: '/regions' },
  { id: 'partner', kind: '지역 업소', title: 'AI 관광 파트너 참여하기', copy: 'AI가 관광객과 우리 업소를 연결합니다. 업소를 등록하고 지역 AI 관광 파트너가 되어보세요.', to: '/partner/apply' },
  { id: 'municipality', kind: '지자체·관광기관', title: '우리 지역 AI 도입하기', copy: '지역 관광자원과 소상공인을 AI로 연결하는 지역형 관광 플랫폼을 직접 체험하고 도입해 보세요.', to: '/region/apply' },
];

const differences = [
  { label: '일반 검색', title: '장소 정보를 찾습니다', copy: '어디에 무엇이 있는지 목록과 정보를 확인합니다.' },
  { label: '범용 AI', title: '질문에 답합니다', copy: '질문한 내용에 맞춰 설명과 아이디어를 제공합니다.' },
  { label: 'EXKOVIA', title: '다음 행동까지 연결합니다', copy: '현재 위치·시간·날씨·여행 상태를 이해하고 지금 할 일을 이어줍니다.' },
];

export default function PlatformPortalPage() {
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
            <Link className="platform-primary-action" to="/regions">지역 AI 컨시어지 시작하기</Link>
            <a className="platform-secondary-action" href="#why-exkovia">어떻게 다른가요?</a>
          </div>
        </div>

        <ol className="platform-journey" aria-label="EXKOVIA 여행 흐름">
          {journeyStages.map((item, index) => <li key={item.stage}>
            <div><span>{item.stage}</span><small>{String(index + 1).padStart(2, '0')}</small></div>
            <p>“{item.copy}”</p>
          </li>)}
        </ol>
      </section>

      <section className="platform-section platform-regions" aria-labelledby="active-regions-title">
        <div className="platform-section-heading">
          <p className="platform-kicker">START IN A REGION</p>
          <h2 id="active-regions-title">운영 지역에서 바로 시작하세요</h2>
          <p>현재 실제 이용 가능한 지역과 준비 중인 지역을 구분해 안내합니다.</p>
        </div>
        <div className="platform-region-grid">
          {regions.map(region => <article className={region.to ? 'is-active' : 'is-upcoming'} key={region.name}>
            <div><span>{region.status}</span><h3>{region.name}</h3><p>{region.detail}</p></div>
            {region.to ? <Link to={region.to}>합천 AI 시작하기 <span aria-hidden="true">→</span></Link> : <span className="platform-region-status" aria-label={`${region.name} 준비 중`}>서비스 준비 중</span>}
          </article>)}
        </div>
      </section>

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
          <h2 id="difference-title">정보를 찾는 데서 멈추지 않습니다</h2>
          <p>EXKOVIA는 단순 관광 홈페이지나 답변형 챗봇이 아니라, 여행의 현재를 이해하고 다음 행동을 이어주는 지역 AI입니다.</p>
        </div>
        <div className="platform-difference-grid">
          {differences.map((item, index) => <article className={index === 2 ? 'is-exkovia' : ''} key={item.label}>
            <small>{item.label}</small><h3>{item.title}</h3><p>{item.copy}</p>
          </article>)}
        </div>
        <div className="platform-lifecycle" aria-label="EXKOVIA 여행 연결 흐름">
          {['PLAN', 'NOW', '상황 변화', 'RE-PLAN', 'ACTION'].map((step, index) => <span key={step}>{step}{index < 4 && <i aria-hidden="true">→</i>}</span>)}
        </div>
      </section>
    </main>
  </div>;
}
