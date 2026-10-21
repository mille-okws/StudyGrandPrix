/*
 * Pure projections for the local study history.
 *
 * Segments are the only source that can be placed on a clock. A legacy block
 * with an aggregate duration is still included in totals, but it deliberately
 * has no invented start/end interval. This keeps old data useful without
 * pretending that a continuous interval was recorded.
 */

const finite = value => typeof value === 'number' && Number.isFinite(value);

function dateValue(value) {
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : null;
}

function seconds(value) {
    return finite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : 0;
}

function validSegment(segment) {
    const start = dateValue(segment?.startedAt);
    const end = dateValue(segment?.endedAt);
    return Boolean(segment?.id && start !== null && end !== null && end > start && seconds(segment.effectiveSeconds) > 0);
}

function overlapSafeRows(segments) {
    const cursors = new Map();
    return segments.flatMap(segment => {
        const cursor = cursors.get(segment.blockId) || -Infinity;
        const start = Math.max(segment.startMs, cursor);
        const maxSeconds = Math.max(0, (segment.endMs - start) / 1000);
        const effectiveSeconds = Math.min(segment.effectiveSeconds, maxSeconds);
        cursors.set(segment.blockId, Math.max(cursor, segment.endMs));
        return effectiveSeconds > 0 ? [{ ...segment, effectiveSeconds }] : [];
    });
}

/** Return closed, chronologically sorted segments with duplicate IDs removed. */
export function exactSegments(snapshot) {
    const seen = new Set();
    return (snapshot?.studySegments || [])
        .filter(segment => segment?.status === 'CLOSED' && validSegment(segment))
        .filter(segment => {
            if (seen.has(segment.id)) return false;
            seen.add(segment.id);
            return true;
        })
        .map(segment => ({
            ...segment,
            startMs: dateValue(segment.startedAt),
            endMs: dateValue(segment.endedAt),
            effectiveSeconds: seconds(segment.effectiveSeconds),
            exactInterval: true
        }))
        .sort((a, b) => a.startMs - b.startMs || String(a.id).localeCompare(String(b.id)));
}

function legacyRows(snapshot) {
    const segments = exactSegments(snapshot);
    const blockIdsWithSegments = new Set(segments.map(segment => segment.blockId));
    const blocks = (snapshot?.studyBlocks || []).filter(block => block?.id);
    const fallbackBlocks = blocks
        .filter(block => !blockIdsWithSegments.has(block.id) && seconds(block.effectiveStudySeconds) > 0)
        .map(block => ({
            id: `aggregate:${block.id}`,
            blockId: block.id,
            subjectId: block.subjectId || block.subject,
            subject: block.subjectName || block.subjectId || block.subject || 'Sem matéria',
            effectiveSeconds: seconds(block.effectiveStudySeconds),
            startedAt: null,
            endedAt: null,
            exactInterval: false,
            source: 'LEGACY_BLOCK'
        }));

    // Old LAP records may predate StudyBlock entirely. Include only rows that
    // are not attached to a block; attached laps are already represented by
    // their segment or aggregate block projection.
    const attachedLapIds = new Set((snapshot?.studyBlocks || []).flatMap(block => block.completedLaps || []));
    const oldLaps = (snapshot?.sessions || [])
        .filter(row => row && row.targetType !== 'STUDY_BLOCK' && !row.blockId && !attachedLapIds.has(row.id) && seconds(row.duration) > 0)
        .map((row, index) => ({
            id: `legacy-lap:${row.id || row.dateKey || index}`,
            blockId: null,
            subjectId: row.subject,
            subject: row.subject || 'Sem matéria',
            effectiveSeconds: seconds(row.duration),
            startedAt: null,
            endedAt: null,
            dateKey: row.dateKey || (dateValue(row.completedAt) === null ? null : new Date(dateValue(row.completedAt)).toISOString().slice(0, 10)),
            exactInterval: false,
            source: 'LEGACY_LAP'
        }));
    return [...fallbackBlocks, ...oldLaps];
}

function addDateBucket(buckets, key, row) {
    if (!key) return;
    const bucket = buckets[key] ||= { date: key, seconds: 0, stints: 0, laps: 0, evaluations: 0, subjects: {} };
    bucket.seconds += row.effectiveSeconds;
    if (row.blockId) bucket.stints += 1;
    if (row.completedLaps) bucket.laps += row.completedLaps.length;
    const subject = row.subject || row.subjectId || 'Sem matéria';
    bucket.subjects[subject] = (bucket.subjects[subject] || 0) + row.effectiveSeconds;
}

/** Build stable, derived metrics without writing to IndexedDB. */
export function buildStudyAnalytics(snapshot, { from = null, to = null } = {}) {
    const exact = exactSegments(snapshot);
    const fallback = legacyRows(snapshot);
    const fromMs = from ? dateValue(from) : null;
    const toMs = to ? dateValue(to) : null;
    const inRange = row => {
        if (!row.exactInterval) {
            if (fromMs === null && toMs === null) return true;
            // Aggregate legacy blocks have no reliable calendar position. Do
            // not place them in a selected day/week/month; callers can still
            // show them in an all-history total.
            if (!row.dateKey) return false;
            const day = dateValue(`${row.dateKey}T00:00:00Z`);
            return day !== null && (fromMs === null || day >= fromMs) && (toMs === null || day < toMs);
        }
        return (fromMs === null || row.endMs >= fromMs) && (toMs === null || row.startMs < toMs);
    };
    const safeExact = overlapSafeRows(exact.filter(inRange));
    const rows = [...safeExact, ...fallback.filter(inRange)];
    const bySubject = {};
    const byDate = {};
    let totalStudySeconds = 0;
    for (const row of rows) {
        totalStudySeconds += row.effectiveSeconds;
        const subject = row.subject || row.subjectId || 'Sem matéria';
        bySubject[subject] = (bySubject[subject] || 0) + row.effectiveSeconds;
        const date = row.exactInterval
            ? new Date(row.startMs).toISOString().slice(0, 10)
            : row.dateKey || (dateValue(row.startedAt) === null ? null : new Date(dateValue(row.startedAt)).toISOString().slice(0, 10));
        addDateBucket(byDate, date, row);
    }
    const blocks = snapshot?.studyBlocks || [];
    const legacyLapCount = (snapshot?.sessions || []).filter(row => row && row.targetType !== 'STUDY_BLOCK' && seconds(row.duration) > 0).length;
    const evaluations = [
        ...(snapshot?.blockEvaluations || []),
        ...(snapshot?.sessions || []).filter(row => row?.targetType === 'LAP' && row?.focus !== undefined)
    ];
    const scores = evaluations.map(row => Number(row.focus)).filter(value => Number.isFinite(value));
    const daysStudied = Object.keys(byDate).length;
    const sortedDates = Object.keys(byDate).sort();
    const latestDate = sortedDates.at(-1) || null;
    return {
        totalStudySeconds,
        totalStudyMinutes: Math.round(totalStudySeconds / 60),
        exactStudySeconds: safeExact.reduce((sum, row) => sum + row.effectiveSeconds, 0),
        historicalAggregateSeconds: fallback.filter(inRange).reduce((sum, row) => sum + row.effectiveSeconds, 0),
        totalSegments: exact.filter(inRange).length,
        totalStints: new Set(rows.filter(row => row.blockId).map(row => row.blockId)).size,
        totalLaps: blocks.reduce((sum, block) => sum + (Array.isArray(block.completedLaps) ? block.completedLaps.length : 0), 0) + legacyLapCount,
        evaluations: evaluations.length,
        averageEvaluation: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
        averageDailySeconds: daysStudied ? totalStudySeconds / daysStudied : 0,
        daysStudied,
        regularity: sortedDates.length ? Math.round((daysStudied / 7) * 100) / 100 : 0,
        latestDate,
        bySubject,
        byDate,
        exactSegments: exact.filter(inRange),
        aggregateRows: fallback.filter(inRange)
    };
}

export function calendarRows(snapshot, { from = null, to = null } = {}) {
    const metrics = buildStudyAnalytics(snapshot, { from, to });
    // Only exact segments are calendar blocks. Aggregate historical rows are
    // exposed separately so callers can show a “duration known, time unknown”
    // note instead of placing them at an invented hour.
    return { segments: metrics.exactSegments, aggregateRows: metrics.aggregateRows };
}

export function formatStudyDuration(value) {
    const total = Math.max(0, Math.round(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours) return `${hours}h${minutes ? ` ${minutes}min` : ''}`;
    return `${minutes}min`;
}

