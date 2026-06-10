/* =====================================================================
 * Bolão da Copa 2026
 * Site estático no Cloudflare Pages. Os dados são salvos como JSON no
 * repositório do GitHub pelas funções em /functions/api/* — o token do
 * GitHub fica só no servidor, ninguém precisa colar chave nenhuma.
 * ===================================================================== */

/* ------------------------- CONFIGURAÇÃO ----------------------------- */
// Pontuação (regras do bolão)
const POINTS = {
  exact: 10,   // acertou o placar exato
  diff: 7,     // acertou o vencedor (ou empate) E o saldo de gols
  winner: 5,   // acertou apenas o vencedor (ou empate)
};

const ENTRY_FEE = "R$ 100,00";
const FEE_DEADLINE = "uma semana antes da final (até 12/07/2026)";

/* ------------------------- TIMES E FASES ----------------------------- */
const TEAMS = {
  "Algeria": ["Argélia", "🇩🇿"], "Argentina": ["Argentina", "🇦🇷"],
  "Australia": ["Austrália", "🇦🇺"], "Austria": ["Áustria", "🇦🇹"],
  "Belgium": ["Bélgica", "🇧🇪"], "Bosnia and Herzegovina": ["Bósnia", "🇧🇦"],
  "Brazil": ["Brasil", "🇧🇷"], "Côte d’Ivoire": ["Costa do Marfim", "🇨🇮"],
  "Cabo Verde": ["Cabo Verde", "🇨🇻"], "Canada": ["Canadá", "🇨🇦"],
  "Colombia": ["Colômbia", "🇨🇴"], "Congo DR": ["RD Congo", "🇨🇩"],
  "Croatia": ["Croácia", "🇭🇷"], "Curaçao": ["Curaçao", "🇨🇼"],
  "Czechia": ["Tchéquia", "🇨🇿"], "Ecuador": ["Equador", "🇪🇨"],
  "Egypt": ["Egito", "🇪🇬"], "England": ["Inglaterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"],
  "France": ["França", "🇫🇷"], "Germany": ["Alemanha", "🇩🇪"],
  "Ghana": ["Gana", "🇬🇭"], "Haiti": ["Haiti", "🇭🇹"],
  "Iran": ["Irã", "🇮🇷"], "Iraq": ["Iraque", "🇮🇶"],
  "Japan": ["Japão", "🇯🇵"], "Jordan": ["Jordânia", "🇯🇴"],
  "Korea Republic": ["Coreia do Sul", "🇰🇷"], "Mexico": ["México", "🇲🇽"],
  "Morocco": ["Marrocos", "🇲🇦"], "Netherlands": ["Holanda", "🇳🇱"],
  "New Zealand": ["Nova Zelândia", "🇳🇿"], "Norway": ["Noruega", "🇳🇴"],
  "Panama": ["Panamá", "🇵🇦"], "Paraguay": ["Paraguai", "🇵🇾"],
  "Portugal": ["Portugal", "🇵🇹"], "Qatar": ["Catar", "🇶🇦"],
  "Saudi Arabia": ["Arábia Saudita", "🇸🇦"], "Scotland": ["Escócia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"],
  "Senegal": ["Senegal", "🇸🇳"], "South Africa": ["África do Sul", "🇿🇦"],
  "Spain": ["Espanha", "🇪🇸"], "Sweden": ["Suécia", "🇸🇪"],
  "Switzerland": ["Suíça", "🇨🇭"], "Türkiye": ["Turquia", "🇹🇷"],
  "Tunisia": ["Tunísia", "🇹🇳"], "United States": ["Estados Unidos", "🇺🇸"],
  "Uruguay": ["Uruguai", "🇺🇾"], "Uzbekistan": ["Uzbequistão", "🇺🇿"],
};

const STAGES = {
  "Group Stage": "Fase de Grupos",
  "Round of 32": "16 avos de final",
  "Round of 16": "Oitavas de final",
  "Quarter-finals": "Quartas de final",
  "Semi-finals": "Semifinal",
  "Third Place": "Disputa de 3º lugar",
  "Final": "Final",
};

function teamLabel(name) {
  if (TEAMS[name]) return `${TEAMS[name][1]} ${TEAMS[name][0]}`;
  // Placeholders do mata-mata ("Group A Winner", "Winner Match 73", ...)
  return name
    .replace(/^Group (\w+) Winner$/, "1º do Grupo $1")
    .replace(/^Group (\w+) Runner-up$/, "2º do Grupo $1")
    .replace(/^Group ([\w/]+) 3rd Place$/, "3º (Grupos $1)")
    .replace(/^Winner Match (\d+)$/, "Vencedor do Jogo $1")
    .replace(/^Loser Match (\d+)$/, "Perdedor do Jogo $1");
}

/* ------------------------- ESTADO ----------------------------------- */
const S = {
  matches: [],
  pools: { pools: {} },
  results: { results: {} },
  config: { admins: [] },
  email: localStorage.getItem("bolao.email") || "",
  poolId: localStorage.getItem("bolao.pool") || "",
  dirty: {},            // palpites alterados e não salvos {matchId: {h,a}}
  dirtyResults: {},     // resultados alterados (admin)
  tab: "palpites",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function me() {
  const pool = S.pools.pools[S.poolId];
  return pool ? pool.members[S.email] : null;
}
function isAdmin() {
  return S.config.admins.map((e) => e.toLowerCase()).includes(S.email);
}
function started(match) {
  return Date.now() >= Date.parse(match.kickoff);
}

/* ------------------------- API DO SERVIDOR --------------------------- */
// Toda gravação passa pelas funções em /api/* (Cloudflare Pages Functions).
async function api(path, body) {
  const r = await fetch("/api/" + path, body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erro ${r.status} no servidor`);
  return j;
}

/* ------------------------- CARREGAMENTO ------------------------------ */
async function fetchStatic(path) {
  const r = await fetch(`${path}?t=${Date.now()}`);
  if (!r.ok) throw new Error(`Falha ao carregar ${path} (${r.status})`);
  return r.json();
}

async function loadAll() {
  S.matches = (await fetchStatic("data/matches.json")).matches;
  try { S.config = await fetchStatic("data/config.json"); } catch { /* opcional */ }

  try {
    // Sempre fresco, direto do GitHub via servidor
    const d = await api("data");
    S.pools = d.pools;
    S.results = d.results;
  } catch (e) {
    // Sem servidor (ex.: teste local com http.server): usa os arquivos publicados
    console.warn("API indisponível, usando arquivos estáticos", e);
    try { S.pools = await fetchStatic("data/pools.json"); } catch { /* primeiro uso */ }
    try { S.results = await fetchStatic("data/results.json"); } catch { /* primeiro uso */ }
  }
}

/* ------------------------- PONTUAÇÃO -------------------------------- */
function scorePrediction(pred, res) {
  if (!pred || !res) return null;
  if (pred.h === res.h && pred.a === res.a) return POINTS.exact;
  const pSign = Math.sign(pred.h - pred.a);
  const rSign = Math.sign(res.h - res.a);
  if (pSign !== rSign) return 0;
  if (pred.h - pred.a === res.h - res.a) return POINTS.diff;
  return POINTS.winner;
}

function standings(pool) {
  const rows = Object.entries(pool.members).map(([email, m]) => {
    let pts = 0, exact = 0, winners = 0, played = 0;
    for (const [id, res] of Object.entries(S.results.results)) {
      const p = scorePrediction(m.predictions?.[id], res);
      if (p === null) continue;
      played++;
      pts += p;
      if (p === POINTS.exact) exact++;
      if (p > 0) winners++;
    }
    return { email, name: m.name || email, pts, exact, winners, played };
  });
  rows.sort((a, b) => b.pts - a.pts || b.exact - a.exact || a.name.localeCompare(b.name));
  return rows;
}

/* ------------------------- TELA DE ENTRADA --------------------------- */
function showEntry() {
  $("#screen-main").hidden = true;
  $("#screen-entry").hidden = false;
  const sel = $("#entry-pool");
  const ids = Object.keys(S.pools.pools);
  sel.innerHTML =
    '<option value="">— escolha um bolão —</option>' +
    ids.map((id) => `<option value="${id}">${esc(S.pools.pools[id].name)}</option>`).join("") +
    '<option value="__new__">➕ Criar novo bolão</option>';
  if (S.poolId && S.pools.pools[S.poolId]) sel.value = S.poolId;
  $("#entry-email").value = S.email;
  onEntryPoolChange();
}

function onEntryPoolChange() {
  const creating = $("#entry-pool").value === "__new__";
  $("#entry-newname-row").hidden = !creating;
}

async function enterPool(ev) {
  ev.preventDefault();
  const sel = $("#entry-pool").value;
  const email = $("#entry-email").value.trim().toLowerCase();
  const name = $("#entry-name").value.trim();
  const accepted = $("#entry-rules").checked;
  const msgEl = $("#entry-msg");
  msgEl.textContent = "";

  if (!sel) return (msgEl.textContent = "Escolha um bolão ou crie um novo.");
  if (!email.includes("@")) return (msgEl.textContent = "Informe um e-mail válido.");
  if (!name) return (msgEl.textContent = "Informe seu nome ou apelido.");
  if (!accepted) return (msgEl.textContent = "Você precisa aceitar as regras para participar.");

  let poolId = sel;
  const creating = sel === "__new__";
  if (creating) {
    const poolName = $("#entry-newname").value.trim();
    if (!poolName) return (msgEl.textContent = "Dê um nome para o novo bolão.");
    poolId = poolName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!poolId) return (msgEl.textContent = "Nome de bolão inválido.");
  }

  // Já é membro? Entra direto, sem gravar nada.
  if (S.pools.pools[poolId]?.members?.[email]) {
    setSession(email, poolId);
    return showMain();
  }

  msgEl.textContent = "Salvando...";
  try {
    const resp = await api("join", {
      poolId: creating ? "" : poolId,
      newPoolName: creating ? $("#entry-newname").value.trim() : "",
      email,
      name,
    });
    S.pools = resp.pools;
    setSession(email, resp.poolId);
    showMain();
  } catch (e) {
    msgEl.textContent = "Erro ao salvar: " + e.message;
  }
}

function setSession(email, poolId) {
  S.email = email;
  S.poolId = poolId;
  localStorage.setItem("bolao.email", email);
  localStorage.setItem("bolao.pool", poolId);
}

function leavePool() {
  localStorage.removeItem("bolao.pool");
  S.poolId = "";
  S.dirty = {};
  showEntry();
}

/* ------------------------- TELA PRINCIPAL ---------------------------- */
function showMain() {
  const pool = S.pools.pools[S.poolId];
  if (!pool || !pool.members[S.email]) return showEntry();
  $("#screen-entry").hidden = true;
  $("#screen-main").hidden = false;
  $("#main-pool-name").textContent = pool.name;
  $("#main-user").textContent = pool.members[S.email].name;
  $("#tab-btn-resultados").hidden = !isAdmin();
  setTab(S.tab);
}

function setTab(tab) {
  if (tab === "resultados" && !isAdmin()) tab = "palpites";
  S.tab = tab;
  $$(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab-panel").forEach((p) => (p.hidden = p.id !== "tab-" + tab));
  if (tab === "palpites") renderPalpites();
  if (tab === "classificacao") renderClassificacao();
  if (tab === "regras") renderRegras();
  if (tab === "resultados") renderResultados();
}

/* ------------------------- ABA PALPITES ------------------------------ */
const fmtDay = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo",
});
const fmtTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});

function renderPalpites() {
  const m = me();
  const showAll = $("#filter-all").checked;
  const wrap = $("#palpites-list");
  wrap.innerHTML = "";
  let lastDay = "";
  let shown = 0;

  for (const match of S.matches) {
    const isOpen = !started(match) && !match.placeholder;
    if (!showAll && !isOpen) continue;

    const day = fmtDay.format(new Date(match.kickoff));
    if (day !== lastDay) {
      lastDay = day;
      wrap.insertAdjacentHTML("beforeend", `<h3 class="day-header">${day}</h3>`);
    }
    wrap.insertAdjacentHTML("beforeend", matchCard(match, m));
    shown++;
  }
  if (!shown) {
    wrap.innerHTML = '<p class="muted">Nenhum jogo aberto para palpite no momento. Use o filtro "todos os jogos".</p>';
  }
  $$("#palpites-list input.score").forEach((inp) => {
    inp.addEventListener("input", onPredictionInput);
  });
  updateSaveBar();
}

function matchCard(match, member) {
  const pred = S.dirty[match.id] ?? member.predictions?.[match.id];
  const res = S.results.results[match.id];
  const locked = started(match) || match.placeholder;
  const pts = scorePrediction(member.predictions?.[match.id], res);

  let badge = "";
  if (match.placeholder) badge = '<span class="badge wait">a definir</span>';
  else if (res) badge = `<span class="badge done">${res.h} x ${res.a}${pts !== null ? ` · ${pts} pts` : ""}</span>`;
  else if (locked) badge = '<span class="badge locked">🔒 fechado</span>';
  else badge = `<span class="badge open">aberto até ${fmtTime.format(new Date(match.kickoff))}</span>`;

  const stageLabel = STAGES[match.stage] + (match.group ? ` · Grupo ${match.group}` : "");

  return `<div class="card ${locked ? "locked" : ""}" data-id="${match.id}">
    <div class="card-top">
      <span class="stage">Jogo ${match.id} · ${stageLabel}</span>
      ${badge}
    </div>
    <div class="card-row">
      <span class="team home">${teamLabel(match.home)}</span>
      <input class="score" data-id="${match.id}" data-side="h" type="number" min="0" max="99"
             inputmode="numeric" ${locked ? "disabled" : ""} value="${pred?.h ?? ""}">
      <span class="x">x</span>
      <input class="score" data-id="${match.id}" data-side="a" type="number" min="0" max="99"
             inputmode="numeric" ${locked ? "disabled" : ""} value="${pred?.a ?? ""}">
      <span class="team away">${teamLabel(match.away)}</span>
    </div>
    <div class="card-bottom muted">${fmtTime.format(new Date(match.kickoff))} (Brasília) · ${esc(match.venue)}, ${esc(match.city)}</div>
  </div>`;
}

function onPredictionInput(ev) {
  const id = ev.target.dataset.id;
  const card = ev.target.closest(".card");
  const h = card.querySelector('input[data-side="h"]').value;
  const a = card.querySelector('input[data-side="a"]').value;
  if (h === "" || a === "") {
    delete S.dirty[id];
  } else {
    S.dirty[id] = { h: Math.max(0, parseInt(h, 10) || 0), a: Math.max(0, parseInt(a, 10) || 0) };
  }
  updateSaveBar();
}

function updateSaveBar() {
  const n = Object.keys(S.dirty).length;
  $("#save-bar").hidden = n === 0;
  $("#save-count").textContent = n;
}

async function savePredictions() {
  const btn = $("#save-btn");
  btn.disabled = true;
  btn.textContent = "Salvando...";
  // Filtro local de jogos já iniciados (o servidor valida de novo, com o relógio dele)
  const valid = {};
  for (const [id, p] of Object.entries(S.dirty)) {
    const match = S.matches.find((mm) => String(mm.id) === String(id));
    if (match && !started(match) && !match.placeholder) valid[id] = p;
  }
  try {
    const resp = await api("predictions", {
      poolId: S.poolId,
      email: S.email,
      predictions: valid,
    });
    S.pools = resp.pools;
    S.dirty = {};
    toast(`Palpites salvos! ✅ (${resp.saved} jogo${resp.saved > 1 ? "s" : ""})`);
    renderPalpites();
  } catch (e) {
    toast("Erro ao salvar: " + e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar palpites";
  }
}

/* ------------------------- ABA CLASSIFICAÇÃO ------------------------- */
function renderClassificacao() {
  const pool = S.pools.pools[S.poolId];
  const rows = standings(pool);
  const hasResults = Object.keys(S.results.results).length > 0;
  let html = `<table class="table">
    <thead><tr><th>#</th><th>Participante</th><th>Pts</th><th title="placares exatos">🎯</th><th title="acertos (vencedor)">✔</th></tr></thead><tbody>`;
  rows.forEach((r, i) => {
    const youCls = r.email === S.email ? ' class="you"' : "";
    html += `<tr${youCls} data-email="${esc(r.email)}">
      <td>${i + 1}º</td><td>${esc(r.name)}</td><td><b>${r.pts}</b></td><td>${r.exact}</td><td>${r.winners}</td></tr>`;
  });
  html += "</tbody></table>";
  if (!hasResults) html += '<p class="muted">A classificação aparece conforme os resultados forem lançados.</p>';
  html += '<p class="muted">Toque em um participante para ver os palpites dele (só de jogos já iniciados).</p>';
  $("#classificacao-content").innerHTML = html;
  $$("#classificacao-content tbody tr").forEach((tr) => {
    tr.addEventListener("click", () => showMemberDetail(tr.dataset.email));
  });
}

function showMemberDetail(email) {
  const pool = S.pools.pools[S.poolId];
  const m = pool.members[email];
  if (!m) return;
  let html = `<h3>Palpites de ${esc(m.name)}</h3>`;
  let any = false;
  for (const match of S.matches) {
    if (!started(match)) continue; // não mostra palpites de jogos futuros (anti-cola)
    const pred = m.predictions?.[match.id];
    if (!pred) continue;
    any = true;
    const res = S.results.results[match.id];
    const pts = scorePrediction(pred, res);
    html += `<div class="mini-row">
      <span>${teamLabel(match.home)} <b>${pred.h} x ${pred.a}</b> ${teamLabel(match.away)}</span>
      <span class="muted">${res ? `placar ${res.h}x${res.a} · ${pts} pts` : "aguardando resultado"}</span>
    </div>`;
  }
  if (!any) html += '<p class="muted">Nenhum palpite visível ainda (jogos não iniciados ficam ocultos).</p>';
  $("#member-detail").innerHTML = html;
  $("#member-modal").hidden = false;
}

/* ------------------------- ABA REGRAS -------------------------------- */
function renderRegras() {
  $("#regras-content").innerHTML = `
  <h3>Pontuação</h3>
  <ul>
    <li><b>${POINTS.exact} pontos</b> — acertou o <b>placar exato</b>.</li>
    <li><b>${POINTS.diff} pontos</b> — acertou o vencedor (ou empate) <b>e o saldo de gols</b>, mas não o placar. <span class="muted">Ex.: palpite 3x1, jogo 2x0.</span></li>
    <li><b>${POINTS.winner} pontos</b> — acertou <b>apenas o vencedor</b> (ou o empate). <span class="muted">Ex.: palpite 2x0, jogo 3x0.</span></li>
    <li><b>0 ponto</b> — errou o resultado.</li>
  </ul>
  <h3>Desempate</h3>
  <p>1º quem tiver mais pontos; 2º quem tiver mais placares exatos; persistindo, divide o prêmio.</p>
  <h3>Palpites</h3>
  <ul>
    <li>Cada palpite pode ser alterado <b>até o horário do início do jogo</b>. Depois disso, fecha.</li>
    <li>Jogo sem palpite vale 0 ponto.</li>
    <li>Palpites dos outros participantes só ficam visíveis depois que o jogo começa.</li>
    <li>Jogos do mata-mata abrem para palpite quando os confrontos forem definidos.</li>
  </ul>
  <h3>Inscrição</h3>
  <p>Cada participante se compromete a pagar <b>${ENTRY_FEE}</b> até ${FEE_DEADLINE}. Quem não pagar até o prazo é desclassificado.</p>
  <p>O prêmio total é dividido conforme combinado no grupo (padrão: leva tudo o 1º colocado).</p>`;
}

/* ------------------------- ABA RESULTADOS (ADMIN) --------------------- */
function renderResultados() {
  const wrap = $("#resultados-list");
  wrap.innerHTML = "";
  const startedMatches = S.matches.filter((m) => started(m) && !m.placeholder);
  if (!startedMatches.length) {
    wrap.innerHTML = '<p class="muted">Nenhum jogo iniciado ainda.</p>';
    return;
  }
  for (const match of startedMatches.reverse()) {
    const res = S.dirtyResults[match.id] ?? S.results.results[match.id];
    wrap.insertAdjacentHTML("beforeend", `
    <div class="card" data-id="${match.id}">
      <div class="card-top"><span class="stage">Jogo ${match.id} · ${STAGES[match.stage]}${match.group ? " · Grupo " + match.group : ""}</span></div>
      <div class="card-row">
        <span class="team home">${teamLabel(match.home)}</span>
        <input class="score result" data-id="${match.id}" data-side="h" type="number" min="0" max="99" inputmode="numeric" value="${res?.h ?? ""}">
        <span class="x">x</span>
        <input class="score result" data-id="${match.id}" data-side="a" type="number" min="0" max="99" inputmode="numeric" value="${res?.a ?? ""}">
        <span class="team away">${teamLabel(match.away)}</span>
      </div>
    </div>`);
  }
  $$("#resultados-list input.result").forEach((inp) => {
    inp.addEventListener("input", (ev) => {
      const id = ev.target.dataset.id;
      const card = ev.target.closest(".card");
      const h = card.querySelector('input[data-side="h"]').value;
      const a = card.querySelector('input[data-side="a"]').value;
      if (h === "" || a === "") delete S.dirtyResults[id];
      else S.dirtyResults[id] = { h: parseInt(h, 10) || 0, a: parseInt(a, 10) || 0 };
      $("#results-save").disabled = Object.keys(S.dirtyResults).length === 0;
    });
  });
  $("#results-save").disabled = true;
}

async function saveResults() {
  const btn = $("#results-save");
  btn.disabled = true;
  try {
    const resp = await api("results", {
      email: S.email,
      results: { ...S.dirtyResults },
    });
    S.results = resp.results;
    S.dirtyResults = {};
    toast("Resultados salvos! ✅");
    renderResultados();
  } catch (e) {
    toast("Erro ao salvar: " + e.message, true);
    btn.disabled = false;
  }
}

/* ------------------------- UTILITÁRIOS -------------------------------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let toastTimer;
function toast(msg, isError) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = isError ? "error" : "";
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4000);
}

/* ------------------------- INICIALIZAÇÃO ------------------------------ */
async function init() {
  $("#entry-form").addEventListener("submit", enterPool);
  $("#entry-pool").addEventListener("change", onEntryPoolChange);
  $("#save-btn").addEventListener("click", savePredictions);
  $("#results-save").addEventListener("click", saveResults);
  $("#filter-all").addEventListener("change", renderPalpites);
  $("#btn-leave").addEventListener("click", leavePool);
  $("#btn-reload").addEventListener("click", async () => {
    toast("Atualizando...");
    await loadAll();
    setTab(S.tab);
    toast("Atualizado ✅");
  });
  $("#member-close").addEventListener("click", () => ($("#member-modal").hidden = true));
  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  try {
    await loadAll();
  } catch (e) {
    $("#entry-msg").textContent = "Erro ao carregar dados: " + e.message;
  }

  if (S.email && S.poolId && S.pools.pools[S.poolId]?.members?.[S.email]) {
    showMain();
  } else {
    showEntry();
  }
}

document.addEventListener("DOMContentLoaded", init);
