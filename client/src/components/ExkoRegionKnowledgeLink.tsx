import { verifiedExkoRegionName, verifiedExkoRegionUrl } from '../exkoLinks';

export default function ExkoRegionKnowledgeLink({regionId,compact=false}:{regionId:string;compact?:boolean}) {
  const url=verifiedExkoRegionUrl(regionId),name=verifiedExkoRegionName(regionId);
  if(!url||!name)return null;
  if(compact)return <div className="exko-region-knowledge-compact"><small>외부 지역지식 서비스</small><a href={url} target="_blank" rel="noopener noreferrer">EXKO에서 {name}군 지역지식 보기 <span aria-hidden="true">↗</span></a></div>;
  return <aside className="exko-region-knowledge" aria-labelledby="exko-region-knowledge-title">
    <div><small>외부 지역지식 서비스</small><h2 id="exko-region-knowledge-title">{name}을 더 깊이 알아보기</h2><p>{name}군의 관광지·역사·문화·자연과 주변 자원의 관계를 EXKO 지역지식에서 살펴보세요.</p></div>
    <a href={url} target="_blank" rel="noopener noreferrer">EXKO에서 {name}군 살펴보기 <span aria-hidden="true">↗</span></a>
  </aside>;
}
