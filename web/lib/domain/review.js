// Pure domain transitions. The future server must authenticate each role and
// apply version checks atomically; this module does not provide access control.
const roles = ['A', 'B'];

function updateStatus(review) {
  const decisions = roles.map(role => review.decisions[role]);
  review.status = decisions.every(value => value === 'accepted')
    ? 'agreed'
    : decisions.includes('needs_changes') ? 'needs_changes' : 'awaiting_review';
  return review;
}

export function createReview(draft) {
  return { version: 1, draft: structuredClone(draft), decisions: { A: 'pending', B: 'pending' }, status: 'awaiting_review' };
}

function assertVersion(review, expectedVersion) {
  if (expectedVersion !== review.version) {
    throw new Error('The plan changed. Read the current version before continuing.');
  }
}

export function reviseReview(review, draft, expectedVersion) {
  assertVersion(review, expectedVersion);
  const updated = createReview(draft);
  updated.version = review.version + 1;
  return updated;
}

export function recordDecision(review, role, decision, expectedVersion) {
  assertVersion(review, expectedVersion);
  if (!roles.includes(role)) throw new RangeError('Unknown partner role.');
  if (!['accepted', 'needs_changes'].includes(decision)) throw new RangeError('Unknown decision.');
  const updated = structuredClone(review);
  updated.decisions[role] = decision;
  return updateStatus(updated);
}
