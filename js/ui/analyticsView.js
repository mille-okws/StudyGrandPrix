import { buildStudyAnalytics, calendarRows, formatStudyDuration } from './analyticsModel.js';

const ptDate = value => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const ptTime = value => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function appendText(parent, tag, text, className = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.append(node);
    return node;
}

/** Render compact telemetry cells. The caller decides when to refresh it. */
export function renderAnalytics(metrics, { root = document.getElementById('telemetryGrid'), countRoot = document.getElementById('telemetrySessionCount') } = {}) {
    if (!root) return;
    root.replaceChildren();
    const cells = [
        ['TEMPO EFETIVO', formatStudyDuration(metrics?.totalStudySeconds)],
        ['STINTS', String(metrics?.totalStints || 0)],
        ['VOLTAS', String(metrics?.totalLaps || 0)],
        ['SEGMENTOS', String(metrics?.totalSegments || 0)],
        ['MÉDIA DIÁRIA', formatStudyDuration(metrics?.averageDailySeconds)],
        ['AVALIAÇÕES', String(metrics?.evaluations || 0)],
        ['FOCO MÉDIO', metrics?.averageEvaluation == null ? '—' : `${metrics.averageEvaluation.toFixed(1)}/10`],
        ['DIAS ESTUDADOS', String(metrics?.daysStudied || 0)]
    ];
    for (const [label, value] of cells) {
        const cell = document.createElement('div');
        cell.className = 'telemetry-cell analytics-cell';
        appendText(cell, 'div', label, 'tlabel');
        appendText(cell, 'div', value, 'tval');
        root.append(cell);
    }
    if (countRoot) countRoot.textContent = `${metrics?.totalSegments || 0} segmentos · ${metrics?.totalStints || 0} stints`;
}

function renderEmpty(root, message) {
    root.replaceChildren();
    appendText(root, 'p', message, 'calendar-empty');
}

function renderDay(root, segments) {
    if (!segments.length) return renderEmpty(root, 'Nenhum intervalo efetivo registrado neste dia.');
    for (const segment of segments) {
        const item = document.createElement('article');
        item.className = 'calendar-stint calendar-segment';
        item.dataset.segmentId = segment.id;
        appendText(item, 'strong', segment.subjectName || segment.subject || segment.subjectId || 'Sem matéria');
        appendText(item, 'span', `${formatStudyDuration(segment.effectiveSeconds)} · ${ptTime(segment.startedAt)}–${ptTime(segment.endedAt)}`);
        appendText(item, 'small', `Stint ${String(segment.blockId || '').slice(0, 8)}`);
        item.tabIndex = 0;
        root.append(item);
    }
}

function weekStart(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
    return value;
}

function renderWeek(root, segments, anchor) {
    const monday = weekStart(anchor);
    const columns = Array.from({ length: 7 }, (_, offset) => {
        const day = new Date(monday); day.setDate(monday.getDate() + offset);
        const key = day.toISOString().slice(0, 10);
        const column = document.createElement('section');
        column.className = 'analytics-week-column';
        column.dataset.date = key;
        appendText(column, 'h3', day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }));
        return { key, column };
    });
    const byDate = new Map(columns.map(column => [column.key, column.column]));
    for (const segment of segments) {
        const key = new Date(segment.startedAt).toISOString().slice(0, 10);
        const column = byDate.get(key);
        if (!column) continue;
        const item = document.createElement('article');
        item.className = 'calendar-segment';
        item.dataset.segmentId = segment.id;
        appendText(item, 'strong', segment.subjectName || segment.subject || segment.subjectId || 'Sem matéria');
        appendText(item, 'span', `${ptTime(segment.startedAt)}–${ptTime(segment.endedAt)} · ${formatStudyDuration(segment.effectiveSeconds)}`);
        column.append(item);
    }
    if (!segments.length) appendText(root, 'p', 'Nenhum intervalo efetivo registrado nesta semana.', 'calendar-empty');
    for (const { column } of columns) root.append(column);
}

function renderMonth(root, metrics, anchor) {
    const year = new Date(anchor).getFullYear();
    const month = new Date(anchor).getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    root.replaceChildren();
    const grid = document.createElement('div');
    grid.className = 'analytics-month-grid';
    for (let day = 1; day <= days; day += 1) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const bucket = metrics.byDate[key];
        const cell = document.createElement('article');
        cell.className = bucket ? 'analytics-month-day has-study' : 'analytics-month-day';
        cell.dataset.date = key;
        appendText(cell, 'strong', String(day));
        appendText(cell, 'span', bucket ? formatStudyDuration(bucket.seconds) : '—');
        if (bucket) appendText(cell, 'small', `${bucket.stints} stint${bucket.stints === 1 ? '' : 's'}`);
        grid.append(cell);
    }
    root.append(grid);
}

/**
 * Render the local calendar. Exact segments are placed at real times; old
 * aggregate records are shown in a separate note and never assigned a fake
 * clock interval.
 */
export function renderStudyCalendar(snapshot, { root = document.getElementById('studyCalendarTimeline'), view = 'day', date = new Date() } = {}) {
    if (!root) return;
    root.replaceChildren();
    const anchor = new Date(date);
    let from = new Date(anchor); let to = new Date(anchor);
    if (view === 'month') { from = new Date(anchor.getFullYear(), anchor.getMonth(), 1); to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1); }
    else if (view === 'week') { from = weekStart(anchor); to = new Date(from); to.setDate(to.getDate() + 7); }
    else { from.setHours(0, 0, 0, 0); to = new Date(from); to.setDate(to.getDate() + 1); }
    const { segments, aggregateRows } = calendarRows(snapshot, { from: from.toISOString(), to: to.toISOString() });
    const metrics = buildStudyAnalytics(snapshot, { from: from.toISOString(), to: to.toISOString() });
    if (view === 'month') renderMonth(root, metrics, anchor);
    else if (view === 'week') renderWeek(root, segments, anchor);
    else renderDay(root, segments);
    if (aggregateRows.length) {
        const note = document.createElement('p');
        note.className = 'calendar-aggregate-note';
        note.textContent = `${formatStudyDuration(aggregateRows.reduce((sum, row) => sum + row.effectiveSeconds, 0))} de histórico antigo sem horários exatos. O calendário não inventa intervalos.`;
        root.append(note);
    }
}

