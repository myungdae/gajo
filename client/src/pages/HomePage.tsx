import { useNavigate } from 'react-router-dom';
import { QUICK_START_PRESETS } from '../quickStartPresets';

const quickStarts=Object.values(QUICK_START_PRESETS);

export default function HomePage(){
  const navigate=useNavigate();
  const descriptions:Record<string,string>={senior:'걷기 편하고 여유로운 일정','family-healing':'온천·식사·체험을 함께 즐기는 일정',indoor:'날씨 걱정 없이 즐기는 실내 일정',nearby:'지금 가까운 곳부터 찾아보기'};
  return <div className="home-page">
    <section className="hero"><small>거창 가조 여행 안내</small><h2>가조에 오신 것을<br/>환영합니다</h2><p>오늘의 가조를 편안하게 만나보세요.</p><span>AI Concierge</span></section>
    <section className="quick-section" aria-labelledby="quick-title"><div className="section-heading"><small>여행 시작하기</small><h2 id="quick-title">어떤 하루를 보내고 싶으세요?</h2></div><div className="quick-list">{quickStarts.map((preset,index)=><button key={preset.id} onClick={()=>navigate(preset.destination,{state:{quickStartPreset:preset.id}})}><span className={`service-icon service-icon-${index+1}`} aria-hidden="true"/><span><b>{preset.title}</b><small>{descriptions[preset.id]}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>)}</div></section>
    <section className="direct-concierge"><small>맞춤 여행 안내</small><h2>직접 이야기해 보세요</h2><p>원하는 일정이나 상황을 편하게 말씀해 주세요.</p><button className="btn btn-primary" onClick={()=>navigate('/concierge')}>대화로 일정 찾기 <span aria-hidden="true">→</span></button></section>
  </div>;
}
