import { useEffect, useState } from 'react';
import type { CreateContextInput } from '../api/client';
import { SHARED_VISITOR_COPY } from '../visitorCopy';
import { buildStructuredContext } from '../utils/structuredIntake';

type Choice={value:string;label:string;hint?:string};
const groups:{key:string;title:string;choices:Choice[]}[]=[
  {key:'companion',title:'누구와 오셨나요?',choices:[{value:'alone',label:'혼자'},{value:'couple',label:'부부'},{value:'parents',label:'부모님'},{value:'children',label:'아이와'},{value:'family',label:'가족 여행'}]},
  {key:'transport',title:'어떻게 이동하시나요?',choices:[{value:'CAR',label:'자동차'},{value:'PUBLIC_TRANSPORT',label:'대중교통'},{value:'WALK',label:'도보'}]},
  {key:'walking',title:'걷기는 어느 정도 괜찮으세요?',choices:[{value:'HIGH',label:'많이 걸어도 괜찮아요'},{value:'MODERATE',label:'보통'},{value:'LOW',label:'짧게 걷고 싶어요'},{value:'LIMITED',label:'걷기가 불편해요'}]},
];
const preferences:Choice[]=[{value:'REST_AND_RECOVERY',label:'편안한 휴식'},{value:'HOT_SPRING',label:'온천'},{value:'FOOD',label:'맛집'},{value:'CAFE',label:'카페'},{value:'NATURE',label:'자연·산책'},{value:'INDOOR',label:'실내 활동'},{value:'ACTIVITY',label:'체험'}];

export default function StructuredVisitorIntake({onSubmit,onChange,loading,initialValues={},initialPreferences=[],entryMessage}:{onSubmit:(input:CreateContextInput)=>void;onChange?:(input:CreateContextInput)=>void;loading:boolean;initialValues?:Record<string,string>;initialPreferences?:string[];entryMessage?:string}){
  const [values,setValues]=useState<Record<string,string>>(()=>({...initialValues})); const [selectedPreferences,setPreferences]=useState<string[]>(()=>[...initialPreferences]); const [age,setAge]=useState(''); const [time,setTime]=useState('');
  const select=(key:string,value:string)=>setValues(current=>({...current,[key]:value}));
  useEffect(()=>{onChange?.(buildStructuredContext(values,age,time,selectedPreferences))},[values,age,time,selectedPreferences,onChange]);
  const submit=()=>{
    onSubmit(buildStructuredContext(values,age,time,selectedPreferences));
  };
  return <section className="card structured-intake" aria-labelledby="structured-intake-title">
    {entryMessage&&<p className="quick-start-entry-message" role="status">{entryMessage}</p>}
    <div className="structured-intake-heading"><small>몇 가지만 선택할게요</small><h2 id="structured-intake-title">몇 가지만 알려주시면 바로 추천해드릴게요.</h2><p>모두 답하지 않아도 괜찮아요.</p></div>
    {groups.map((group,index)=><fieldset key={group.key} className="journey-question"><legend><span>{index+1}</span>{group.title}</legend><div className="intake-choice-grid">{group.choices.map(choice=><button type="button" key={choice.value} className={values[group.key]===choice.value?'selected':''} aria-pressed={values[group.key]===choice.value} onClick={()=>select(group.key,choice.value)}>{choice.label}</button>)}</div>{group.key==='companion'&&values.companion==='parents'&&<label className="optional-age">부모님 연령 <input type="number" min="0" max="120" inputMode="numeric" value={age} onChange={event=>setAge(event.target.value)} placeholder="선택 입력"/> 세</label>}</fieldset>)}
    <fieldset className="journey-question"><legend><span>4</span>언제까지 머무르시나요?</legend><div className="time-choice"><input type="time" value={time} onChange={event=>setTime(event.target.value)}/><button type="button" className={!time?'selected':''} onClick={()=>setTime('')}>시간 미정</button></div></fieldset>
    <fieldset className="journey-question"><legend><span>5</span>무엇을 원하시나요?</legend><div className="intake-choice-grid preference-grid">{preferences.map(choice=>{const selected=selectedPreferences.includes(choice.value);return <button type="button" key={choice.value} className={selected?'selected':''} aria-pressed={selected} onClick={()=>setPreferences(current=>selected?current.filter(value=>value!==choice.value):[...current,choice.value])}>{choice.label}</button>})}</div></fieldset>
    <button type="button" className="btn btn-primary btn-block structured-submit" disabled={loading} onClick={submit}>{SHARED_VISITOR_COPY.recommendationButton}</button>
  </section>;
}
