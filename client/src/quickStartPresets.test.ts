import test from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_START_PRESETS, getQuickStartPreset } from './quickStartPresets.ts';
import { buildStructuredContext } from './utils/structuredIntake.ts';

test('senior hydrates parent, LOW walking, short distance, and rest',()=>{const p=QUICK_START_PRESETS.senior;assert.equal(p.context.companions?.[0].relationship,'parent');assert.equal(p.context.walkingLevel,'LOW');assert.deepEqual(p.context.companionConstraints,['shortWalkingDistance']);assert.deepEqual(p.context.activityPreferences,['REST_AND_RECOVERY'])});
test('family healing hydrates family and rest without LOW walking',()=>{const p=QUICK_START_PRESETS['family-healing'];assert.equal(p.context.companions?.[0].relationship,'family');assert.deepEqual(p.context.wellnessGoals,['restAndRecovery']);assert.equal(p.context.walkingLevel,undefined)});
test('indoor preference never fabricates rainy weather',()=>{const p=QUICK_START_PRESETS.indoor;assert.deepEqual(p.context.activityPreferences,['INDOOR']);assert.equal(p.context.weather,undefined)});
test('nearby never fabricates coordinates',()=>{const p=QUICK_START_PRESETS.nearby;assert.equal(p.destination,'/nearby-discovery');assert.equal(p.context.latitude,undefined);assert.equal(p.context.longitude,undefined)});
test('visitor changes replace preset defaults while retaining other selections',()=>{const changed=buildStructuredContext({companion:'parents',walking:'LOW',transport:'CAR'},'', '17:00',['REST_AND_RECOVERY','HOT_SPRING']);assert.equal(changed.transportMode,'CAR');assert.equal(changed.stayUntil,'17:00');assert.deepEqual(changed.activityPreferences,['REST_AND_RECOVERY','HOT_SPRING'])});
test('unknown or absent state gives direct concierge no preset',()=>{assert.equal(getQuickStartPreset(undefined),undefined);assert.equal(getQuickStartPreset('unknown'),undefined)});
