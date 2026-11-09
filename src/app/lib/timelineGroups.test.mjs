import test from 'node:test';
import assert from 'node:assert/strict';
import {groupTimelineRoles} from './timelineGroups.mjs';
import {normalizeTimeline,localizeTimeline,timelineOperations,readTimeline} from './cvTimelineData.mjs';
test('explicit groups combine subsidiaries while retaining role indices and order',()=>{
 const roles=[{id:'a',employerGroup:'CAPTRON',company:'CAPTRON USA'},{id:'b'},{id:'c',employerGroup:' captron ',company:'CAPTRON Germany'},{id:'d',company:'CAPTRON USA'}];
 const groups=groupTimelineRoles(roles);
 assert.deepEqual(groups.map(g=>g.roles.map(r=>r.index)),[[0,2],[1],[3]]);
 assert.equal(groups[0].label,'CAPTRON');
 assert.equal(groups[0].roles[1].item,roles[2]);
});
test('group persists, localizes independently, and can be cleared',async()=>{
 const entry=normalizeTimeline([{id:'a',employerGroup:' CAPTRON ',translations:{en:{title:'CEO',period:'2026'}}}])[0];
 assert.equal(localizeTimeline([entry],'de')[0].employerGroup,'CAPTRON');
 const stored=timelineOperations([entry])[0].updateOne.update.$set;
 assert.equal(stored.employerGroup,'CAPTRON');
 const db={collection:()=>({find:()=>({sort:()=>({toArray:async()=>[{_id:'a',...stored}]})}),findOne:async()=>({revision:1})})};
 assert.equal((await readTimeline(db)).entries[0].employerGroup,'CAPTRON');
 const cleared=normalizeTimeline([{...entry,employerGroup:''}])[0];
 assert.equal(timelineOperations([cleared])[0].updateOne.update.$set.employerGroup,'');
 assert.throws(()=>normalizeTimeline([{...entry,employerGroup:{}}]));
});
test('collapsed groups omit selected roles without changing detail indices',()=>{
 const roles=[{id:'old',employerGroup:'CAPTRON',showAfterMore:true},{id:'new',employerGroup:'CAPTRON'},{id:'other',showAfterMore:true}];
 assert.deepEqual(groupTimelineRoles(roles,false).map(g=>g.roles.map(r=>r.index)),[[1]]);
 assert.deepEqual(groupTimelineRoles(roles,true).map(g=>g.roles.map(r=>r.index)),[[0,1],[2]]);
 assert.equal(groupTimelineRoles([roles[0]],false).length,0);
});
test('See more setting persists and can be disabled',async()=>{
 const entry=normalizeTimeline([{id:'a',showAfterMore:true,translations:{en:{title:'Role',period:'2026'}}}])[0];
 assert.equal(localizeTimeline([entry],'de')[0].showAfterMore,true);
 const stored=timelineOperations([entry])[0].updateOne.update.$set;
 assert.equal(stored.showAfterMore,true);
 const db={collection:()=>({find:()=>({sort:()=>({toArray:async()=>[{_id:'a',...stored}]})}),findOne:async()=>({revision:1})})};
 assert.equal((await readTimeline(db)).entries[0].showAfterMore,true);
 assert.equal(timelineOperations([{...entry,showAfterMore:false}])[0].updateOne.update.$set.showAfterMore,false);
 assert.throws(()=>normalizeTimeline([{...entry,showAfterMore:'yes'}]));
});
