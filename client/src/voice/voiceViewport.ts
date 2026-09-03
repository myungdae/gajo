export interface VoiceViewport {
  width:number; height:number; offsetTop:number; offsetLeft:number;
  navTop?:number; navBottom?:number;
}
export function voiceWindowBounds(view:VoiceViewport){
  const bottom=view.offsetTop+view.height;
  const navOverlap=view.navTop==null||view.navBottom==null?0:
    Math.max(0,Math.min(bottom,view.navBottom)-Math.max(view.offsetTop,view.navTop));
  const available=Math.max(0,view.height-navOverlap-16);
  return {
    left:view.offsetLeft+view.width/2,
    bottom:bottom-navOverlap-8,
    center:view.offsetTop+(view.height-navOverlap)/2,
    width:Math.max(0,Math.min(480,view.width-16)),
    maxHeight:available,
    sheet:view.width<=600||view.height<=500,
  };
}
