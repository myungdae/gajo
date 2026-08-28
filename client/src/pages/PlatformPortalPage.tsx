import { Link } from 'react-router-dom';
import '../platform.css';
const entrances=[
  {kind:'여행자',title:'AI 여행 시작하기',copy:'AI와 여행을 계획하고 현장에서 추천·주변 찾기·혜택·여행기록을 이용하세요.',to:'/regions'},
  {kind:'지역 업소',title:'AI 관광 파트너 참여하기',copy:'AI가 관광객과 우리 업소를 연결합니다. 업소를 등록하고 지역 AI 관광 파트너가 되어보세요.',to:'/partner/apply'},
  {kind:'지자체·관광기관',title:'우리 지역 AI 도입하기',copy:'지역 관광자원과 소상공인을 AI로 연결하는 지역형 관광 플랫폼을 직접 체험하고 도입해 보세요.',to:'/region/apply'},
];
export default function PlatformPortalPage(){return <div className="platform-page"><header className="platform-header"><Link to="/" className="platform-brand">EXKOVIA</Link><span>지역과 여행자를 잇는 AI 관광 플랫폼</span></header><main className="platform-main"><section className="platform-hero"><p className="platform-kicker">REGIONAL AI CONCIERGE</p><h1>여행의 순간과<br/>지역의 가치를 연결합니다</h1><p>여행자, 지역 업소, 지자체·관광기관이 각자의 목적에 맞는 입구에서 바로 시작할 수 있습니다.</p><nav className="platform-audience-summary" aria-label="이용 대상"><a href="#traveler">여행자</a><a href="#partner">지역 업소</a><a href="#municipality">지자체·관광기관</a></nav></section><section className="platform-entrances" aria-label="EXKOVIA 시작하기">{entrances.map((x,index)=><article id={['traveler','partner','municipality'][index]} key={x.kind}><small>{x.kind}</small><h2>{x.title}</h2><p>{x.copy}</p><Link className="platform-cta" to={x.to}>{x.title}<span aria-hidden="true">→</span></Link></article>)}</section><p className="platform-principle">가입 없이 가치를 확인하고, 실제 서비스를 먼저 체험해 보세요.</p></main></div>}
