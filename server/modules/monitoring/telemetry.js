const sampleSeconds = 10;
const sampleMs = sampleSeconds * 1000;
const historySamples = 180;
const activityMinutes = 5;
const activityMs = activityMinutes * 60_000;
const activityLimit = 25_000;
const attemptHours = 24;
const startedAt = Date.now();
const buckets = new Map();
const activeAccounts = new Map();
const failedAuth = new Map();
const signInPaths = new Set(['/auth/login', '/auth/password/login', '/auth/password/recover', '/auth/invitations/redeem']);
let requestsTotal = 0;
let errorsTotal = 0;
let duplicateVotesTotal = 0;
let voteSavesTotal = 0;
let activityCappedUntil = 0;

function forgetBefore(collection, minimum) {
    for (const [key] of collection) {
        if (key >= minimum) break;
        collection.delete(key);
    }
}

export function measureRequest(req, res, next) {
    const path = req.path.replace(/\/$/, '').toLowerCase();
    if (path === '/admin/nexus/telemetry' || path === '/admin/system') return next();

    const started = performance.now();
    res.once('finish', () => {
        const now = Date.now();
        const bucketTime = Math.floor(now / sampleMs) * sampleMs;
        forgetBefore(buckets, bucketTime - (historySamples - 1) * sampleMs);
        const bucket = buckets.get(bucketTime) ?? { requests: 0, errors: 0, latency: 0, voteSaves: 0 };
        bucket.requests++;
        bucket.latency += performance.now() - started;
        requestsTotal++;
        if (res.statusCode >= 500) {
            bucket.errors++;
            errorsTotal++;
        }
        if (req.method === 'POST' && path === '/votes') {
            if (res.statusCode === 201) {
                voteSavesTotal++;
                bucket.voteSaves++;
            }
            if (res.locals.duplicateVote) duplicateVotesTotal++;
        }
        buckets.set(bucketTime, bucket);

        if (req.method === 'POST' && signInPaths.has(path) && res.statusCode >= 400 && res.statusCode < 500) {
            const minute = Math.floor(now / 60_000);
            forgetBefore(failedAuth, minute - attemptHours * 60 + 1);
            failedAuth.set(minute, (failedAuth.get(minute) ?? 0) + 1);
        }
    });
    next();
}

export function noteAccountActivity(id) {
    const now = Date.now();
    activeAccounts.delete(id);
    if (activeAccounts.size >= activityLimit) {
        const [oldId, oldAt] = activeAccounts.entries().next().value;
        if (oldAt + activityMs > now) activityCappedUntil = Math.max(activityCappedUntil, oldAt + activityMs);
        activeAccounts.delete(oldId);
    }
    activeAccounts.set(id, now);
}

export function accountActivityAt(id) {
    const last = activeAccounts.get(id);
    return last && last >= Date.now() - activityMs ? new Date(last).toISOString() : null;
}

export function activitySummary() {
    const now = Date.now();
    for (const [id, at] of activeAccounts) {
        if (at >= now - activityMs) break;
        activeAccounts.delete(id);
    }
    return { active_users: activeAccounts.size, activity_minutes: activityMinutes, activity_capped: now < activityCappedUntil };
}

export function requestSummary() {
    const newest = Math.floor(Date.now() / sampleMs) * sampleMs;
    const oldest = Math.max(newest - (historySamples - 1) * sampleMs, Math.floor(startedAt / sampleMs) * sampleMs);
    forgetBefore(buckets, oldest);
    const history = [];
    for (let at = oldest; at <= newest; at += sampleMs) {
        const entry = buckets.get(at);
        history.push({
            at: new Date(at).toISOString(),
            requests: entry?.requests ?? 0,
            errors: entry?.errors ?? 0,
            vote_saves: entry?.voteSaves ?? 0,
            mean_latency_ms: entry ? Math.round(entry.latency / entry.requests * 10) / 10 : null,
        });
    }
    return { started_at: new Date(startedAt).toISOString(), sample_seconds: sampleSeconds,
        requests_total: requestsTotal, errors_total: errorsTotal,
        vote_saves_total: voteSavesTotal, duplicate_votes_total: duplicateVotesTotal, history };
}

export function failedAttemptSummary() {
    const minute = Math.floor(Date.now() / 60_000);
    forgetBefore(failedAuth, minute - attemptHours * 60 + 1);
    return {
        failed_attempts: [...failedAuth.values()].reduce((sum, count) => sum + count, 0),
        attempt_period_hours: attemptHours,
        attempt_tracking_since: new Date(startedAt).toISOString(),
    };
}
