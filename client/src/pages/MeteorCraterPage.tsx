import { useNavigate } from 'react-router-dom';
import { useRegion } from '../RegionContext';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { localizedRegionalPath } from '../visitorRouting';
import { MANAGED_VISITOR_COPY as copy } from '../managedVisitorCopy';
export default function MeteorCraterPage() {
  const region = useRegion(), navigate = useNavigate(), { language } = useRegionalLanguage();
  const text = (key: keyof typeof copy) => copy[key][language];
  const go = (message: string) => navigate(localizedRegionalPath('/concierge?mode=now', region.id), { state: { tripMode: 'NOW', freeTextOpen: true, initialMessage: message, autoSubmit: true } });
  const sections = [['craterSpecial', 'craterUnique'], ['craterFormation', 'craterHow'], ['craterView', 'craterWhere'], ['craterOpen', 'craterStatus'], ['craterTour', 'craterRoute']] as const;
  return <article className="regional-home">
    <section className="spotlight-card"><div><small>{text('craterStory')}</small><h1>{text('craterTitle')}</h1><p>{text('craterLead')}</p></div></section>
    {sections.map(([heading, body]) => <section className="card" key={heading}><h2>{text(heading)}</h2><p>{text(body)}</p></section>)}
    <div className="spotlight-actions">
      <button onClick={() => go('합천운석충돌구 관광안내소를 보여주세요.')}>{text('visitorCenter')}</button>
      <button onClick={() => go('대암산 전망대 길찾기를 도와주세요.')}>{text('observatoryDirections')}</button>
      <button onClick={() => go('합천운석충돌구 환종주 탐방로를 보여주세요.')}>{text('trail')}</button>
      <button onClick={() => go('합천운석충돌구를 일정에 담아 주세요.')}>{text('addItinerary')}</button>
    </div>
  </article>;
}
