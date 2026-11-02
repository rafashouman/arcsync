import test from 'node:test';
import assert from 'node:assert/strict';
import {planDestinations} from '../src/libs/destinationPlanning.ts';
import {publishingMonitor} from '../src/libs/publishingMonitor.ts';
const now = Date.parse('2030-01-01T12:00:00Z');
const post = {_id:'1',platforms:['instagram','youtube'],scheduledFor:new Date(now-180000).toISOString(),destinations:[{platform:'instagram',scheduledFor:new Date(now+3600000).toISOString()},{platform:'youtube',scheduledFor:new Date(now-180000).toISOString()}],status:'pending'};
test('later first network never blocks an earlier other destination',()=>{assert.equal(planDestinations(post,[],now).platform,'youtube');assert.equal(planDestinations(post,[{platform:'youtube',state:'published'}],now).platform,undefined);});
test('monitor evaluates per-destination due time and ignores published destinations',()=>{assert.equal(publishingMonitor([post],now).length,1);assert.equal(publishingMonitor([{...post,platformStatuses:[{platform:'youtube',state:'published'}]}],now).length,0);});
