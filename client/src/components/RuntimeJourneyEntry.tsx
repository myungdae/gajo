import { useEffect, useState } from 'react';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { useRegion } from '../RegionContext';
import { JOURNEY_COPY, JOURNEY_OPTIONS, journeyRequest, journeyPreferences, type JourneyPreferences } from '../runtimeJourney';
import type { CreateContextInput } from '../api/client';
import { ensureTripSession, sessionContext, mergeTravelContext, type PlannedContext } from '../tripSession';
import { RegionalActionIcon, type RegionalHomeActionType } from './RegionalActionIcon';
import './runtime-journey.css';

export default function RuntimeJourneyEntry({ loading, onCreate, onDirect, onSubmit, auxiliary = false }: {
  loading: boolean; onCreate: (text: string, context: CreateContextInput, planned: PlannedContext) => void; onDirect: () => void; onSubmit?: (text:string) => void; auxiliary?: boolean;
}) {
  const { language } = useRegionalLanguage(), region = useRegion(), copy = JOURNEY_COPY[language];
  const [known,setKnown] = useState(() => sessionContext(ensureTripSession(region.id)));
  const [value, setValue] = useState<JourneyPreferences>(() => journeyPreferences(known));
  const [changed,setChanged]=useState<Array<keyof JourneyPreferences>>([]);
  const [firstVisit,setFirstVisit]=useState(ensureTripSession(region.id).plannedContext?.firstVisit);
  const [text,setText]=useState('');
  const [textEntryOpen,setTextEntryOpen]=useState(false);
  useEffect(()=>{const refresh=()=>{const context=sessionContext(ensureTripSession(region.id));setKnown(context);setValue(journeyPreferences(context));setChanged([])};window.addEventListener('regional-trip-saved',refresh);return()=>window.removeEventListener('regional-trip-saved',refresh)},[region.id]);
  const label = (row: readonly string[]) => row[language === 'ko' ? 1 : 2];
  const choices = (key: keyof JourneyPreferences, rows: readonly (readonly string[])[]) => <div className={`runtime-choice-grid${key==='goal'?' runtime-goal-chips':''}`}>{rows.map(row =>
    <button type="button" key={row[0]} aria-pressed={key==='goal'&&!changed.includes('goal') ? Boolean(known.activityPreferences?.some(tag=>tag===row[0]||(row[0]==='NEXT_PLACE'&&['NATURE','TOURISM_NATURE'].includes(tag)))) : value[key] === row[0]} onClick={() => {setValue(v => ({ ...v, [key]: row[0] }));setChanged(keys=>[...new Set([...keys,key])])}}>
      {key === 'goal' && <RegionalActionIcon type={row[0] as RegionalHomeActionType} />}<span>{key==='goal'&&language==='ko'?({FOOD:'맛집',CAFE:'카페',ACCOMMODATION:'숙소',NEXT_PLACE:'가볼 곳',EVENT_TODAY:'행사'} as Record<string,string>)[row[0]]:label(row)}</span>
    </button>)}</div>;
  return <section className="runtime-journey-entry" aria-labelledby="runtime-journey-title">
    {!auxiliary&&<>
    <h1 id="runtime-journey-title">{language === 'ko' ? '무엇을 원하시는지 알려주세요' : 'Tell me what you need'}</h1>
    <p>{language === 'ko' ? '지금 필요한 것을 말이나 글로 알려주시면 위치·시간·날씨와 함께 보고 찾아드릴게요.' : 'Tell me what you need by voice or text, and I will use your location, time and weather to help.'}</p>

    <div className="entry-input-actions">
      <button type="button" className="btn btn-primary" onClick={onDirect}>{language === 'ko' ? '말로 알려주기' : 'Tell me by voice'}</button>
      {onSubmit&&<button type="button" className="btn btn-outline" onClick={()=>setTextEntryOpen(open=>!open)} aria-expanded={textEntryOpen}>{language === 'ko' ? '글로 입력하기' : 'Type instead'}</button>}
    </div>

    {onSubmit&&textEntryOpen&&<form onSubmit={event=>{event.preventDefault();if(text.trim())onSubmit(text.trim())}}>
      <textarea aria-label={language==='ko'?'여행 요청':'Travel request'} rows={2} value={text} onChange={event=>setText(event.target.value)} placeholder={language==='ko'?'예) 배고파요, 커피 마시고 싶어요, 잘 곳이 필요해요.':'For example: I am hungry, I want coffee, or I need a place to stay.'}/>
      <button type="submit" className="btn btn-primary btn-block" disabled={loading||!text.trim()}>{language==='ko'?'이대로 찾아보기':'Find what I need'}</button>
    </form>}

    {!onSubmit&&<button type="button" className="btn btn-primary" onClick={onDirect}>{language === 'ko' ? '말로 알려주기' : 'Tell me by voice'}</button>}
    </>}
    <details className="entry-optional-conditions"><summary>{language==='ko'?'말이나 글 대신 선택하거나, 조건 수정하기':'Choose or adjust preferences'}</summary>
    <fieldset><legend>{copy.question}</legend>{choices('goal', JOURNEY_OPTIONS.goal)}</fieldset>
    <div className="runtime-compact-conditions">
      <fieldset><legend>{language === 'ko' ? '동행' : 'Companions'}</legend>{choices('companion', JOURNEY_OPTIONS.companion)}</fieldset>
      <fieldset><legend>{language === 'ko' ? '시간' : 'Time available'}</legend>{choices('duration', JOURNEY_OPTIONS.duration)}{known.stayUntil && !value.duration && <small>{language === 'ko' ? `앞서 알려주신 ${known.stayUntil}까지` : `Until ${known.stayUntil}, as you told me`}</small>}</fieldset>
    </div>

    <button className="btn btn-primary btn-block" disabled={loading} onClick={() => {
      const request = journeyRequest(Object.fromEntries(changed.map(key=>[key,value[key]])), language); onCreate(request.text, mergeTravelContext(known, request.context), {...request.planned,...(firstVisit===undefined?{}:{firstVisit})});
    }}>{loading ? (language === 'ko' ? '여행을 만들고 있어요' : 'Creating your journey') : language === 'ko' ? '이 조건으로 여행 만들기' : copy.create}</button>
    <small>{language === 'ko' ? '선택하지 않은 조건은 건너뛰어도 괜찮아요.' : 'You can leave any preference blank.'}</small>
    <details><summary>{language === 'ko' ? '이동·보행 조건 수정' : 'Adjust transport and walking'}</summary>
      <fieldset><legend>{language==='ko'?'이번이 첫 방문인가요? (선택)':'First visit? (Optional)'}</legend><div className="runtime-choice-grid">{[true,false].map(value=><button key={String(value)} type="button" aria-pressed={firstVisit===value} onClick={()=>setFirstVisit(value)}>{language==='ko'?(value?'처음이에요':'다시 왔어요'):(value?'First time':'Returning')}</button>)}</div></fieldset>
      <fieldset><legend>{language === 'ko' ? '이동' : 'Transport'}</legend>{choices('transport', JOURNEY_OPTIONS.transport)}</fieldset>
      <fieldset><legend>{language === 'ko' ? '걷기' : 'Walking'}</legend>{choices('walking', JOURNEY_OPTIONS.walking)}</fieldset>
    </details>
    </details>
  </section>;
}
