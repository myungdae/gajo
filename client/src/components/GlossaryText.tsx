import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { GUIDE_GLOSSARY, type GuideGlossaryEntry } from '../guideGlossary';
import './GlossaryText.css';

const labels=GUIDE_GLOSSARY.flatMap(entry=>[entry.term,...entry.aliases].map(label=>({label,entry}))).sort((a,b)=>b.label.length-a.label.length);
const matcher=new RegExp(`(${labels.map(({label})=>label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`,'g');
const byLabel=new Map<string,GuideGlossaryEntry>(labels.map(item=>[item.label,item.entry]));

function GlossaryTerm({label,entry}:{label:string;entry:GuideGlossaryEntry}){
  const [open,setOpen]=useState(false),id=useId(),root=useRef<HTMLSpanElement>(null);
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open]);
  return <span className="guide-glossary" ref={root}><button type="button" className="guide-glossary-term" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==='Escape')setOpen(false)}}>{label}</button>{open&&<span id={id} className="guide-glossary-popover" role="note"><strong>{entry.term}</strong><span>{entry.definition}</span><button type="button" onClick={()=>setOpen(false)} aria-label={`${entry.term} 설명 닫기`}>닫기</button></span>}</span>;
}
export function GlossaryText({text}:{text:string}){return <span className="glossary-text">{text.split('\n').map((line,lineIndex)=><Fragment key={`${lineIndex}-${line}`}>{lineIndex>0&&<br/>}{line.split(matcher).map((part,index)=>{const entry=byLabel.get(part);return entry?<GlossaryTerm key={`${index}-${part}`} label={part} entry={entry}/>:<Fragment key={`${index}-${part}`}>{part}</Fragment>})}</Fragment>)}</span>}
