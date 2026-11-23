import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,advance,snapshot,gardenAction,simulation} from '../src/state.js';
test('growth stops when water exhausted, even offline',()=>{const r=advance({crop:'小麦',water:22,progress:0,updated:0},1000);assert.equal(r.water,0);assert.ok(Math.abs(r.progress-100/180*100)<.001)});
test('plant, water, harvest cannot duplicate',()=>{const s=initial();gardenAction(s,1,{action:'plant',crop:'小麦'},100);assert.throws(()=>gardenAction(s,1,{action:'plant',crop:'小麦'},100));gardenAction(s,1,{action:'water'},120);gardenAction(s,1,{action:'harvest'},400);assert.equal(s.slots[0].harvests,1);assert.throws(()=>gardenAction(s,1,{action:'harvest'},400));});
test('broadcast and farm derive identical clock and crop',()=>{const s=initial();simulation(s,{hour:6,season:'winter',weather:'snow'},100);simulation(s,{day_running:true},100);assert.equal(snapshot(s,160).simulation.hour,12);assert.equal(snapshot(s,160).simulation.weather,'snow');assert.deepEqual(snapshot(s,160),snapshot(s,160));});
test('invalid simulation input does not silently succeed',()=>{assert.throws(()=>simulation(initial(),{area_multiplier:9}));assert.throws(()=>simulation(initial(),{kind:'insects',plot_id:-99}));});
test('visitors are independent',()=>{const a=initial(),b=initial();gardenAction(a,1,{action:'plant',crop:'番茄'});assert.equal(b.slots[0].crop,null)});
