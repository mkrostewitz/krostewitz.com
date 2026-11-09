import test from 'node:test';
import assert from 'node:assert/strict';
import {initialTimelineDates, formatTimelinePeriod} from './timelineDates.mjs';
import {normalizeTimeline, localizeTimeline, timelineOperations, readTimeline} from './cvTimelineData.mjs';
test('explicit legacy months are inferred, ambiguous years are not', () => {
  assert.deepEqual(initialTimelineDates({translations:{en:{period:'Sep 2022 — Dec 2026'}}}),{startDate:'2022-09',endDate:'2026-12',current:false});
  assert.deepEqual(initialTimelineDates({translations:{de:{period:'März 2022 — Heute'}}}),{startDate:'2022-03',endDate:'',current:true});
  assert.equal(initialTimelineDates({translations:{en:{period:'2022–2026'}}}).startDate,'');
});
const base={id:'role',startDate:'2022-09',endDate:'2026-12',current:false,translations:{en:{title:'Director'}}};
test('dates persist independently of translations and format in either language', async () => {
  const entry=normalizeTimeline([base])[0];
  assert.equal(entry.translations.en.period,'Sep 2022 — Dec 2026');
  assert.match(localizeTimeline([entry],'de')[0].period,/2022.*2026/);
  const saved=timelineOperations([entry])[0].updateOne.update.$set;
  assert.equal(saved.startDate,'2022-09');
  const db={collection:()=>({find:()=>({sort:()=>({toArray:async()=>[{_id:'role',...saved}]})}),findOne:async()=>({revision:1})})};
  assert.equal((await readTimeline(db)).entries[0].endDate,'2026-12');
  const current=normalizeTimeline([{...base,current:true}])[0];
  assert.equal(current.endDate,'');
  assert.equal(formatTimelinePeriod(current,'en'),'Sep 2022 — Present');
  assert.match(localizeTimeline([current],'de')[0].period,/Heute$/);
});
test('date validation rejects missing, malformed and reversed ranges', () => {
  for (const patch of [{startDate:''},{startDate:'2022-13'},{endDate:''},{endDate:'2020-01'},{current:'yes'}]) {
    assert.throws(()=>normalizeTimeline([{...base,...patch}]));
  }
});
test('future full dates persist and invalid calendar dates are rejected', () => {
  const entry=normalizeTimeline([{...base,endDate:'2027-01-28'}])[0];
  assert.equal(entry.endDate,'2027-01-28');
  assert.match(formatTimelinePeriod(entry,'de'),/28\. Jan\. 2027$/);
  assert.equal(timelineOperations([entry])[0].updateOne.update.$set.endDate,'2027-01-28');
  for (const endDate of ['2027-02-29','2027-04-31','2027-01-00']) {
    assert.throws(()=>normalizeTimeline([{...base,endDate}]));
  }
  assert.doesNotThrow(()=>normalizeTimeline([{...base,endDate:'2028-02-29'}]));
});
