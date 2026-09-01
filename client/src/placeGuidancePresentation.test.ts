import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=(name:string)=>readFileSync(new URL(name,root),'utf8');
test('place guidance stays a data-driven two-line layer outside canonical selection',()=>{const component=read('src/components/PlaceGuidanceSummary.tsx'),page=read('src/pages/ConciergePage.tsx'),css=read('src/index.css');assert.match(page,/<PlaceGuidanceSummary guidance=\{entity\.placeGuidance\}/);assert.match(component,/guidance\.shortDescription/);assert.match(component,/guidance\.situationalMessage/);assert.match(component,/guidance\.actionSuggestion/);assert.match(component,/observedAt/);assert.doesNotMatch(component,/hapcheon|황매산|해인사|영상테마파크/i);assert.match(css,/\.place-guidance[^]*min-width:\s*0[^]*overflow-wrap:\s*anywhere/);assert.match(css,/-webkit-line-clamp:\s*1/);assert.match(css,/@media \(max-width: 390px\)/)});
