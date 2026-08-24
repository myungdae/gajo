import {HttpException,HttpStatus,Injectable}from'@nestjs/common';
import{GUIDE_KNOWLEDGE,type GuideAudience,type GuideKnowledge}from'./guide-knowledge';

@Injectable()
export class GuideService{
 private windows=new Map<string,{started:number,count:number}>();
 private limit(clientId:string){const now=Date.now(),current=this.windows.get(clientId);if(!current||now-current.started>=60000){this.windows.set(clientId,{started:now,count:1});return}if(current.count>=20)throw new HttpException('Guide request limit exceeded',HttpStatus.TOO_MANY_REQUESTS);current.count+=1}
 private audience(question:string,requested?:GuideAudience):GuideAudience{if(requested&&requested!=='GENERAL')return requested;if(/업체|상인|사업자|가게|매출/.test(question))return'BUSINESS';if(/지자체|공공|군청|시청|공무원/.test(question))return'PUBLIC_SECTOR';if(/여행|관광객|내\s*위치|동행/.test(question))return'VISITOR';return'GENERAL'}
 private resolve(question:string,previousIntent?:string){if(/구글에서\s*(?:그냥\s*)?가져오는\s*정보/i.test(question))return GUIDE_KNOWLEDGE.find(x=>x.intent==='HYPERLOCAL_DATA_GOVERNANCE');if(previousIntent==='WEBSITE_OR_MOBILE'&&/(?:어떻게.*(?:가져|가지|가질|넣)|휴대폰|설치)/i.test(question))return GUIDE_KNOWLEDGE.find(x=>x.intent==='PHONE_ACCESS');if(/구글도.*(?:추천|ai)|chatgpt.*위치.*똑같/i.test(question)||previousIntent==='MAP_DIFFERENCE'&&/그래도|추천|ai|똑같/.test(question))return GUIDE_KNOWLEDGE.find(x=>x.intent==='MAP_OBJECTION');return GUIDE_KNOWLEDGE.map(entry=>({entry,score:entry.patterns.reduce((sum,p)=>sum+(p.test(question)?1:0),0)+(entry.intent===previousIntent&&/그래도|그런데|그럼/.test(question)?1:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0]?.entry}
 answer(input:{question?:string;audience?:GuideAudience;previousIntent?:string},clientId='anonymous'){
  this.limit(clientId);const question=String(input.question||'').trim().slice(0,500);if(!question)return{status:'INVALID',message:'질문을 입력해 주세요.'};const knowledge=this.resolve(question,input.previousIntent),audience=this.audience(question,input.audience);if(!knowledge)return{status:'REVIEW_CANDIDATE',candidate:{type:'NEW_GUIDE_QUESTION',questionStored:false,requiresHumanApproval:true},answer:'아직 승인된 안내 지식에서 정확한 답을 찾지 못했습니다. 운영 정보는 추측하지 않고 검토가 필요한 질문으로 구분할게요.',audience};return this.present(knowledge,audience)
 }
 private present(knowledge:GuideKnowledge,audience:GuideAudience){const tailored=knowledge.audienceAnswers?.[audience],perspective=!tailored&&(audience==='BUSINESS'?'업체 입장에서 보면, 정확한 정보와 적절한 행동 연결이 핵심입니다.':audience==='PUBLIC_SECTOR'?'공공 관점에서는 신뢰할 수 있는 지역 데이터 관리와 지속성이 핵심입니다.':undefined);return{status:'ANSWERED',intent:knowledge.intent,audience,answer:[tailored||knowledge.shortAnswer,perspective].filter(Boolean).join(' '),supportingConcepts:knowledge.supportingConcepts,relatedQuestions:knowledge.relatedQuestions,readOnly:true}}
}
