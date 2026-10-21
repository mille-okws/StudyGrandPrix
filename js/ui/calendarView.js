function dateKey(date) { return new Date(date).toISOString().slice(0, 10); }
function inPeriod(segment, period, date) {
    const start = new Date(segment.startedAt); const selected = new Date(date);
    if (period === 'month') return start.getFullYear() === selected.getFullYear() && start.getMonth() === selected.getMonth();
    if (period === 'week') { const monday = new Date(selected); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); const next = new Date(monday); next.setDate(next.getDate() + 7); return start >= monday && start < next; }
    return dateKey(start) === dateKey(selected);
}
export function renderInternalCalendar(snapshot, { root = document.getElementById('studyCalendarTimeline'), period = 'day', date = new Date() } = {}) {
    if (!root) return;
    const blocks = new Map((snapshot?.studyBlocks || []).map(block => [block.id, block]));
    const segments = (snapshot?.studySegments || []).filter(segment => segment.status === 'CLOSED' && segment.endedAt && inPeriod(segment, period, date));
    root.innerHTML = '';
    if (!segments.length) { root.textContent = 'Nenhum intervalo efetivo registrado neste período.'; return; }
    for (const segment of segments.sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
        const block = blocks.get(segment.blockId) || {}; const item = document.createElement('article'); item.className = 'calendar-stint calendar-segment';
        const minutes = Math.round(Number(segment.effectiveSeconds || 0) / 60); item.innerHTML = `<strong></strong><span></span><small></small>`;
        item.querySelector('strong').textContent = block.subjectName || block.subject || segment.subjectId;
        item.querySelector('span').textContent = `${minutes} min efetivos · ${(block.completedLaps || []).length} voltas · stint ${block.id?.slice(0, 8) || ''}`;
        item.querySelector('small').textContent = `${new Date(segment.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}–${new Date(segment.endedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; root.append(item);
    }
}
