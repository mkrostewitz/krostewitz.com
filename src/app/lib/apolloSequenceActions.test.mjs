import test from 'node:test';
import assert from 'node:assert/strict';
import {changeApolloMembership, performSequenceAction, validateSequenceAction} from './apolloSequenceActions.mjs';
const sequenceId = 'a'.repeat(24), targetSequenceId = 'b'.repeat(24), contactId = 'c'.repeat(24);
const progress = status => ({membershipsKnown: true, sequences: status ? [{id: sequenceId, status}] : []});
test('rejects unknown actions, malformed IDs and moves to the same sequence', () => {
  for (const input of [{action: 'resume', sequenceId}, {action: 'remove', sequenceId: '../bad'}, {action: 'move', sequenceId, targetSequenceId: sequenceId}]) assert.throws(() => validateSequenceAction(input));
});
test('pause uses the contact-specific stop endpoint, never the global campaign', async () => {
  await changeApolloMembership({apiKey: 'test', contactId, sequenceId, action: 'pause', fetchImpl: async (url, options) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get('contact_ids[]'), contactId);
    assert.equal(query.get('emailer_campaign_ids[]'), sequenceId);
    assert.equal(query.get('mode'), 'stop');
    assert.equal(options.method, 'POST');
    return {ok: true};
  }});
});
test('pause and remove require no contact sync or mandatory data', async () => {
  for (const action of ['pause', 'remove']) {
    let reads = 0, changed;
    const result = await performSequenceAction({action, sequenceId,
      read: async () => reads++ ? progress(action === 'pause' ? 'paused' : null) : progress('active'),
      change: async value => {changed = value;}, sync: () => assert.fail('Must not sync before stopping emails')});
    assert.equal(changed, action); assert.ok(result.message);
  }
});
test('move syncs details, confirms removal, then enrolls in destination', async () => {
  const calls = []; let reads = 0;
  const result = await performSequenceAction({action: 'move', sequenceId, targetSequenceId,
    read: async () => {calls.push('read'); return reads++ ? progress(null) : progress('active');},
    change: async action => calls.push(action),
    sync: async (enroll, id) => {calls.push(enroll ? 'enroll' : 'sync'); if (enroll) assert.equal(id, targetSequenceId); return {detailsUpdated: true, labelsAdded: true, sequenceStatus: 'enrolled', message: 'OK'};},
  });
  assert.deepEqual(calls, ['read', 'sync', 'remove', 'read', 'enroll', 'read']);
  assert.match(result.message, /Moved/);
});
test('failed required fields or sync never removes the old membership', async () => {
  await assert.rejects(performSequenceAction({action: 'move', sequenceId, targetSequenceId,
    read: async () => progress('active'), change: () => assert.fail('Must not remove'),
    sync: async () => ({detailsUpdated: false, message: 'Missing fields'})}), /Move not started/);
});
test('unconfirmed removal and unknown memberships never enroll', async () => {
  for (const known of [true, false]) {
    await assert.rejects(performSequenceAction({action: 'move', sequenceId, targetSequenceId,
      read: async () => ({...progress('active'), membershipsKnown: known}), change: async () => {},
      sync: async enroll => {assert.equal(enroll, false); return {detailsUpdated: true, labelsAdded: true};}}), /not confirmed|did not report/);
  }
});
test('failed destination enrollment reports partial completion without re-adding old membership', async () => {
  let reads = 0, mutations = 0;
  const result = await performSequenceAction({action: 'move', sequenceId, targetSequenceId,
    read: async () => reads++ ? progress(null) : progress('active'), change: async () => {mutations++;},
    sync: async enroll => enroll ? {sequenceStatus: 'skipped', message: 'Blocked by Apollo'} : {detailsUpdated: true, labelsAdded: true}});
  assert.equal(mutations, 1); assert.match(result.message, /Removed from the old sequence, but new enrollment is not confirmed/);
});
test('timeouts do not retry membership mutations', async () => {
  let calls = 0;
  await assert.rejects(changeApolloMembership({apiKey: 'test', contactId, sequenceId, action: 'remove', fetchImpl: async () => {calls++; throw new Error('timeout');}}), /Refresh/);
  assert.equal(calls, 1);
});
