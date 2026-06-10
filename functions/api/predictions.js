import { ghGetJson, mutateJson, json, err, requireToken, normEmail, cleanScore } from "./_lib.js";

// POST /api/predictions { poolId, email, predictions: { "<matchId>": {h,a} } }
// A trava de horário é aplicada AQUI, com o relógio do servidor:
// palpite de jogo já iniciado (ou ainda indefinido) é descartado.
export async function onRequestPost({ request, env }) {
  const missing = requireToken(env);
  if (missing) return missing;

  let body;
  try { body = await request.json(); } catch { return err("Corpo inválido."); }

  const email = normEmail(body.email);
  const poolId = String(body.poolId || "").trim();
  const incoming = body.predictions || {};
  if (!email || !poolId) return err("Dados incompletos.");
  if (typeof incoming !== "object") return err("Palpites inválidos.");

  let matches;
  try {
    matches = (await ghGetJson(env, "data/matches.json")).data.matches;
  } catch (e) {
    return err("Falha ao ler a tabela de jogos: " + e.message, 502);
  }
  const byId = new Map(matches.map((m) => [String(m.id), m]));

  const now = Date.now();
  const valid = {};
  const rejected = [];
  for (const [id, p] of Object.entries(incoming)) {
    const match = byId.get(String(id));
    const h = cleanScore(p?.h);
    const a = cleanScore(p?.a);
    if (!match || h === null || a === null) { rejected.push(id); continue; }
    if (match.placeholder || now >= Date.parse(match.kickoff)) { rejected.push(id); continue; }
    valid[String(id)] = { h, a };
  }
  if (!Object.keys(valid).length) {
    return err("Nenhum palpite válido para salvar (jogos já iniciados ficam travados).");
  }

  try {
    const pools = await mutateJson(env, "data/pools.json", () => ({ pools: {} }), (d) => {
      const member = d.pools?.[poolId]?.members?.[email];
      if (!member) throw Object.assign(new Error("Participante não encontrado neste bolão."), { user: true });
      member.predictions = member.predictions || {};
      Object.assign(member.predictions, valid);
    }, `Palpites de ${email} (${poolId})`);
    return json({ pools, saved: Object.keys(valid).length, rejected });
  } catch (e) {
    return err(e.user ? e.message : "Falha ao salvar: " + e.message, e.user ? 400 : 502);
  }
}
