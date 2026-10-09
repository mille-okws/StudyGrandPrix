// Subject preferences are independent of session history: deleting a subject
// never deletes completed sessions, and IDs remain stable when names change.
const KEY = "studyGrandPrixSubjects";
const LEGACY_NAMES = {
    calculo: "Cálculo / Matemática",
    estruturas: "Estruturas / Resistência dos Materiais",
    termo: "Termodinâmica / Fluidos",
    eletrica: "Eletricidade / Circuitos",
    programacao: "Programação",
    outra: "Estudo livre"
};
const DEFAULTS = [
    { id: "matematica", name: "Matemática" },
    { id: "idiomas", name: "Idiomas" },
    { id: "historia", name: "História" },
    { id: "ciencias", name: "Ciências" },
    { id: "programacao", name: "Programação" },
    { id: "outra", name: "Estudo livre" }
];
let preferences;
const normalizeName = name => name.trim().replace(/\s+/g, " ");
const comparable = name => normalizeName(name).toLocaleLowerCase("pt-BR");

export function getSelectedSubject() {
    const subject = preferences?.subjects.find(item => item.id === preferences.selectedId);
    return subject ? { ...subject } : { id: "outra", name: "Estudo livre" };
}

export function initializeSubjects(sessions = []) {
    const select = document.getElementById("subjectSelect");
    const status = document.getElementById("subjectStatus");
    const edit = document.getElementById("editSubjectName");
    const add = document.getElementById("newSubjectName");
    let stored;
    try { stored = JSON.parse(localStorage.getItem(KEY)); } catch { /* Recover with defaults. */ }
    const seen = new Set();
    const subjects = Array.isArray(stored?.subjects) ? stored.subjects.filter(item => {
        if (!item || typeof item.id !== "string" || !item.id ||
            typeof item.name !== "string" || !normalizeName(item.name) || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    }).map(item => ({ id: item.id, name: normalizeName(item.name) })) : [];
    if (!subjects.length) {
        subjects.push(...DEFAULTS.map(item => ({ ...item })));
        // Recover subjects used in old sessions without rewriting their history.
        for (const session of sessions) {
            if (typeof session.subject !== "string" || !session.subject || subjects.some(item => item.id === session.subject)) continue;
            subjects.push({ id: session.subject, name: typeof session.subjectName === "string" && normalizeName(session.subjectName) ? normalizeName(session.subjectName) : LEGACY_NAMES[session.subject] || session.subject });
        }
    }
    preferences = {
        subjects,
        selectedId: subjects.some(item => item.id === stored?.selectedId) ? stored.selectedId : subjects[0].id
    };

    function render() {
        select.replaceChildren(...preferences.subjects.map(subject => {
            const option = document.createElement("option");
            option.value = subject.id;
            option.textContent = subject.name;
            return option;
        }));
        select.value = preferences.selectedId;
        edit.value = getSelectedSubject().name;
    }
    function commit(next, message) {
        try {
            localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
            status.textContent = "Não foi possível salvar. Verifique se o navegador permite armazenamento local.";
            render();
            return false;
        }
        preferences = next;
        render();
        status.textContent = message;
        return true;
    }
    function validate(name, exceptId) {
        if (!name || name.length > 80) {
            status.textContent = "Digite um nome de 1 a 80 caracteres.";
            return false;
        }
        if (preferences.subjects.some(item => item.id !== exceptId && comparable(item.name) === comparable(name))) {
            status.textContent = "Essa matéria já está na lista.";
            return false;
        }
        return true;
    }
    select.addEventListener("change", () => commit({ ...preferences, selectedId: select.value }, "Matéria selecionada. A mudança vale para a próxima sessão iniciada."));
    document.getElementById("addSubjectForm").addEventListener("submit", event => {
        event.preventDefault();
        const name = normalizeName(add.value);
        if (!validate(name)) return;
        const subject = { id: crypto.randomUUID(), name };
        if (commit({ subjects: [...preferences.subjects, subject], selectedId: subject.id }, "Matéria adicionada e selecionada.")) add.value = "";
    });
    document.getElementById("editSubjectForm").addEventListener("submit", event => {
        event.preventDefault();
        const name = normalizeName(edit.value);
        if (!validate(name, preferences.selectedId)) return;
        commit({ ...preferences, subjects: preferences.subjects.map(item => item.id === preferences.selectedId ? { ...item, name } : item) }, "Nome atualizado. O histórico foi preservado.");
    });
    document.getElementById("deleteSubjectBtn").addEventListener("click", () => {
        if (preferences.subjects.length === 1) {
            status.textContent = "Mantenha ao menos uma matéria na lista.";
            return;
        }
        const remaining = preferences.subjects.filter(item => item.id !== preferences.selectedId);
        commit({ subjects: remaining, selectedId: remaining[0].id }, "Matéria removida da lista. O histórico foi preservado.");
    });
    render();
}
