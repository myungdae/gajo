import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceWindowBounds } from './voiceViewport.ts';
test('voice window stays inside each viewport and above bottom navigation',()=>{
  for(const [width,height] of [[360,800],[390,844],[844,390],[195,422],[1200,900]]){
    const b=voiceWindowBounds({width,height,offsetTop:0,offsetLeft:0,navTop:height-72,navBottom:height});
    assert.ok(b.width<=width-16);
    assert.ok(b.bottom<=height-72);
    assert.ok(b.maxHeight<=height-72-16);
    assert.equal(b.sheet,width<=600||height<=500);
  }
});
test('iOS keyboard viewport offsets exclude the offscreen navigation and keep the window above the keyboard',()=>{
  const b=voiceWindowBounds({width:390,height:360,offsetTop:120,offsetLeft:0,navTop:770,navBottom:844});
  assert.equal(b.bottom,472);assert.equal(b.maxHeight,344);assert.equal(b.left,195);
  const partlyVisible=voiceWindowBounds({width:390,height:700,offsetTop:0,offsetLeft:0,navTop:680,navBottom:760});
  assert.equal(partlyVisible.bottom,672);
});
