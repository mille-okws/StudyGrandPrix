const KEY = "studyGrandPrixChampionship";
const DAILY_GOAL = 25 * 60;
const DAY_NAMES = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromKey(key) {
    return new Date(`${key}T12:00:00`);
}
function plusDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
export function weekStart(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    return start;
}
export function weeklyResult(byDate = {}, date = new Date(), provisional = false) {
    const start = weekStart(date);
    const today = dateKey(date);
    const days = Array.from({ length: 7 }, (_, index) => {
        const key = dateKey(plusDays(start, index));
        const entry = byDate[key];
        // Legacy daily entries contain lap counts; each lap is conservatively
        // treated as five minutes only when no duration was recorded.
        const seconds = Math.max(0, Number(entry?.totalSeconds) || (Number(entry?.laps ?? entry) || 0) * 300);
        return { key, seconds: provisional && key > today ? 0 : seconds, label: DAY_NAMES[index] };
    });
    const targetDays = provisional ? Math.min(5, (date.getDay() + 6) % 7 + 1) : 5;
    const credits = days.reduce((total, day) => total + Math.min(1, day.seconds / DAILY_GOAL), 0);
    const score = Math.min(1, credits / targetDays);
    const position = score === 0 ? 22 : Math.max(1, 22 - Math.ceil(score * 21));
    return {
        key: dateKey(start), end: dateKey(plusDays(start, 6)), position,
        days, activeDays: days.filter(day => day.seconds >= DAILY_GOAL).length,
        totalMinutes: Math.floor(days.reduce((total, day) => total + day.seconds, 0) / 60),
        targetDays, score
    };
}
function period(result) {
    const format = key => fromKey(key).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${format(result.key)} a ${format(result.end)}`;
}
export function renderChampionship(store, now = new Date()) {
    const card = document.getElementById("championshipCard");
    const award = document.getElementById("weeklyAward");
    if (!card || !award) return;
    let saved;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* recover from invalid preferences */ }
    const current = weeklyResult(store.byDate, now, true);
    const history = Object.keys(store.byDate || {}).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= dateKey(now) && !Number.isNaN(fromKey(key).getTime())).sort();
    const firstWeek = saved?.firstWeek && /^\d{4}-\d{2}-\d{2}$/.test(saved.firstWeek) && saved.firstWeek <= current.key
        ? saved.firstWeek : dateKey(weekStart(fromKey(history[0] || current.key)));
    const awards = saved?.awards && typeof saved.awards === "object" && !Array.isArray(saved.awards) ? { ...saved.awards } : {};
    // Closed weeks are awarded once. Reopening the app never duplicates a prize.
    let changed = !saved;
    for (let start = fromKey(firstWeek); dateKey(start) < current.key; start = plusDays(start, 7)) {
        const key = dateKey(start);
        if (!awards[key]) {
            const result = weeklyResult(store.byDate, start);
            awards[key] = { key: result.key, end: result.end, position: result.position, activeDays: result.activeDays, totalMinutes: result.totalMinutes };
            changed = true;
        }
    }
    let storageError = false;
    if (changed) {
        try { localStorage.setItem(KEY, JSON.stringify({ firstWeek, awards })); } catch { storageError = true; }
    }
    const previousKey = dateKey(plusDays(weekStart(now), -7));
    const previous = awards[previousKey];
    const difference = previous ? previous.position - current.position : 0;
    const movement = !previous ? "— Primeira semana" : difference > 0 ? `↑ Subiu ${difference} ${difference === 1 ? "posição" : "posições"}` : difference < 0 ? `↓ Caiu ${-difference} ${difference === -1 ? "posição" : "posições"}` : "→ Manteve a posição";
    const put = (id, value) => { document.getElementById(id).textContent = value; };
    put("championshipPosition", `P${current.position}`);
    put("championshipPeriod", period(current));
    put("championshipMovement", movement);
    document.getElementById("championshipMovement").dataset.direction = difference > 0 ? "up" : difference < 0 ? "down" : "same";
    put("championshipProgress", `${current.activeDays} ${current.activeDays === 1 ? "dia" : "dias"} com 25 min · ${current.totalMinutes} min de estudo`);
    put("championshipComparison", previous ? `Comparação com P${previous.position} na semana anterior. Posição atual provisória.` : "Posição provisória. A comparação aparece após a primeira semana.");
    document.getElementById("championshipDays").replaceChildren(...current.days.map(day => {
        const item = document.createElement("span");
        item.className = `championship-day${day.seconds >= DAILY_GOAL ? " complete" : day.seconds > 0 ? " partial" : ""}`;
        item.textContent = day.label;
        item.title = `${day.key}: ${Math.floor(day.seconds / 60)} minutos de estudo`;
        item.setAttribute("aria-label", item.title);
        return item;
    }));
    const title = !previous ? "Sua primeira premiação está chegando" : previous.position === 1 ? "Campeão da semana" : previous.position <= 3 ? "Pódio da semana" : previous.position === 22 ? "Uma nova chance nesta semana" : "Semana concluída";
    put("awardTitle", title);
    put("awardPosition", previous ? `P${previous.position}` : "—");
    put("awardDescription", previous ? `${period(previous)} · ${previous.activeDays} dias com 25 min · ${previous.totalMinutes} min. ${previous.position === 22 ? "Sem estudo registrado; sem troféu nesta semana." : previous.position <= 3 ? "Troféu conquistado pela sua consistência!" : "Resultado registrado. Continue para alcançar o pódio."}` : "A semana termina no domingo. Seu resultado e a premiação aparecem na segunda-feira, ao abrir o sistema.");
    award.dataset.tier = !previous || previous.position === 22 ? "none" : previous.position === 1 ? "gold" : previous.position === 2 ? "silver" : previous.position === 3 ? "bronze" : "participation";
    document.getElementById("awardIcon").toggleAttribute("hidden", !previous || previous.position > 3);
    put("championshipStorage", storageError ? "Não foi possível salvar a premiação neste navegador." : "");
}
