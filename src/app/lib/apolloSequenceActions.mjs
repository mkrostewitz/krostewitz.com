import {ApolloEnrichmentError} from './apolloEnrichment.mjs';

const idPattern = /^[a-f0-9]{24}$/i;
export function validateSequenceAction({action, sequenceId, targetSequenceId}) {
  if (!['pause', 'remove', 'move'].includes(action) || !idPattern.test(sequenceId || '')) throw new ApolloEnrichmentError('Choose a valid sequence action.', 400);
  if (action === 'move' && (!idPattern.test(targetSequenceId || '') || targetSequenceId === sequenceId)) throw new ApolloEnrichmentError('Choose a different destination sequence.', 400);
}

export async function changeApolloMembership({apiKey, contactId, sequenceId, action, fetchImpl = fetch}) {
  validateSequenceAction({action, sequenceId});
  if (action === 'move' || !idPattern.test(contactId || '')) throw new ApolloEnrichmentError('Invalid membership action.', 400);
  const query = new URLSearchParams({'contact_ids[]': contactId, 'emailer_campaign_ids[]': sequenceId, mode: action === 'pause' ? 'stop' : 'remove'});
  let response;
  try {
    response = await fetchImpl(`https://api.apollo.io/api/v1/emailer_campaigns/remove_or_stop_contact_ids?${query}`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20000), headers: {accept: 'application/json', 'X-Api-Key': apiKey},
    });
  } catch { throw new ApolloEnrichmentError('Apollo did not confirm the sequence action. Refresh its status before retrying.'); }
  if (!response.ok) throw new ApolloEnrichmentError([401, 403].includes(response.status)
    ? 'Apollo denied this action. Enable api/v1/emailer_campaigns/remove_or_stop_contact_ids in your API key permissions.'
    : `Apollo rejected the sequence action (HTTP ${response.status}). Refresh status before retrying.`);
  // A successful HTTP response alone is not proof of a membership change.
}

export async function performSequenceAction({action, sequenceId, targetSequenceId, read, change, sync}) {
  validateSequenceAction({action, sequenceId, targetSequenceId});
  const before = await read();
  if (!before.membershipsKnown) throw new ApolloEnrichmentError('Apollo did not report sequence memberships. Refresh before changing sequences.');
  const membership = before.sequences.find(item => item.id === sequenceId);
  if (!membership && action === 'pause') throw new ApolloEnrichmentError('The contact is no longer in this sequence.', 409);
  if (action === 'move') {
    const synced = await sync(false);
    if (!synced.detailsUpdated || !synced.labelsAdded) throw new ApolloEnrichmentError(`Move not started. ${synced.message}`);
  }
  if (membership) await change(action === 'pause' ? 'pause' : 'remove');
  let progress;
  try { progress = await read(); }
  catch { throw new ApolloEnrichmentError('The sequence action was submitted, but its result could not be verified. No new enrollment was attempted. Refresh Apollo status.'); }
  const current = progress.sequences.find(item => item.id === sequenceId);
  const confirmed = progress.membershipsKnown && (action === 'pause'
    ? current && ['paused', 'stopped'].includes(current.status)
    : !current || current.status === 'removed');
  if (!confirmed) throw new ApolloEnrichmentError('Apollo has not confirmed the sequence change. No new enrollment was attempted. Refresh Apollo status before retrying.');
  if (action !== 'move') return {progress, message: action === 'pause' ? 'Contact paused. Future steps in this sequence are stopped.' : 'Contact removed from this sequence.'};
  let enrollment;
  try { enrollment = await sync(true, targetSequenceId); }
  catch (error) { throw new ApolloEnrichmentError(`Removed from the old sequence, but new enrollment failed: ${error.message}`); }
  const success = ['enrolled', 'already_enrolled'].includes(enrollment.sequenceStatus);
  const message = success ? `Moved to the selected sequence. ${enrollment.message}` : `Removed from the old sequence, but new enrollment is not confirmed. ${enrollment.message}`;
  try { progress = await read(); } catch { return {enrollment, message: `${message} Refresh Apollo status to see current memberships.`, progress: null}; }
  return {enrollment, progress, message};
}
