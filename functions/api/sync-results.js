import { ghGetJson, mutateJson, json, err, requireToken } from "./_lib.js";

const WC_API = "https://worldcup26.ir/get/games";

// Mapeia nomes da API externa → nomes do nosso matches.json
const NAME_MAP = {
  "South Korea": "Korea Republic",
  "Czech Republic": "Czechia",
  "Turkey": "Türkiye",
  "Ivory Coast": "Côte d'Ivoire",
  "Cape Verde": "Cabo Verde",
  "DR Congo": "Congo DR",
};
function normalize(name) { return NAME_MAP[name] || name; }

// GET /api/sync-results → busca resultados da API pública e grava os novos.
// POST /api/sync-results → mesma coisa (para poder chamar de cron/webhook).
export async function onRequestGet(ctx) { return sync(ctx); }
export async function onRequestPost(ctx) { return sync(ctx); }

async function sync({ env }) {
  const missing = requireToken(env);
  if (missing) return missing;

  let apiGames;
  try {
    const r = await fetch(WC_API);
    if (!r.ok) throw new Error(`API retornou ${r.status}`);
    apiGames = await r.json();
  } catch (e) {
    return err("Falha ao buscar resultados da API: " + e.message, 502);
  }

  let matches;
  try {
    matches = (await ghGetJson(env, "data/matches.json")).data.matches;
  } catch (e) {
    return err("Falha ao ler matches.json: " + e.message, 502);
  }

  // Monta mapa matchId → match do nosso schedule
  const byId = new Map(matches.map((m) => [String(m.id), m]));

  // Monta mapa por times (para casar jogos cujos IDs divergem)
  const byTeams = new Map();
  for (const m of matches) {
    if (!m.placeholder) byTeams.set(`${m.home}|${m.away}`, m);
  }

  const finished = apiGames.filter((g) => g.finished === "TRUE");
  if (!finished.length) return json({ updated: 0, message: "Nenhum jogo finalizado ainda." });

  const newResults = {};
  for (const g of finished) {
    const h = parseInt(g.home_score, 10);
    const a = parseInt(g.away_score, 10);
    if (isNaN(h) || isNaN(a)) continue;

    // Tenta casar por ID direto primeiro
    let match = byId.get(String(g.id));
    // Se não casou, tenta por nomes dos times
    if (!match) {
      const home = normalize(g.home_team_name_en);
      const away = normalize(g.away_team_name_en);
      match = byTeams.get(`${home}|${away}`);
    }
    if (!match) continue;
    newResults[String(match.id)] = { h, a };
  }

  if (!Object.keys(newResults).length) {
    return json({ updated: 0, message: "Nenhum resultado novo para salvar." });
  }

  try {
    const data = await mutateJson(
      env, "data/results.json", () => ({ results: {} }),
      (d) => { d.results = { ...d.results, ...newResults }; },
      `[CI Skip] Resultados automáticos (${Object.keys(newResults).length} jogos)`,
    );
    return json({ updated: Object.keys(newResults).length, results: data.results });
  } catch (e) {
    return err("Falha ao gravar resultados: " + e.message, 502);
  }
}
