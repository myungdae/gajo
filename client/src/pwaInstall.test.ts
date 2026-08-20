import test from 'node:test';
import assert from 'node:assert/strict';
import { installDismissalKey, isIosSafari, isStandalone, manifestHref } from './pwaInstall.ts';
test('each region uses a manifest that reopens its own entry path',()=>{for(const id of ['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu'] as const)assert.equal(manifestHref(id),`/manifest-${id}.webmanifest`)});
test('iOS Safari detection excludes iOS Chromium',()=>{assert.equal(isIosSafari('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1','Apple Computer, Inc.'),true);assert.equal(isIosSafari('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/120 Mobile/15E148 Safari/604.1','Apple Computer, Inc.'),false)});
test('standalone supports display mode and iOS flag',()=>{assert.equal(isStandalone({matchMedia:()=>({matches:true}) as MediaQueryList} as Window,{} as Navigator),true);assert.equal(isStandalone({matchMedia:()=>({matches:false}) as MediaQueryList} as Window,{standalone:true} as Navigator),true)});
test('dismissal is region scoped',()=>assert.notEqual(installDismissalKey('hapcheon'),installDismissalKey('gajo')));
