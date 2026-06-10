import { ghGetJson, mutateJson, json, err, requireToken, normEmail, cleanScore } from "./_lib.js";

// POST /api/results { email, results: { "<matchId>": {h,a} } }
// Só e-mails listados em data/config.json (admins) podem lançar placar,
// e só de jogos que já começaram.
export async function onRequestPost({ request, env }) {
  const missing = requireToken(env);
  if (missing) return missing;

  let body;
  try { body = await request.json(); } catch { return err("Corpo inválido."); }

  const email = normEmail(body.email);
  const incoming = body.results || {};
  if (!email) return err("E-mail inválido.");

  let admins, matches;
  try {
    const [cfg, mt] = await Promise.all([
      ghGetJson(env, "data/config.json"),
      ghGetJson(env, "data/matches.json"),
    ]);
    admins = (cfg.data?.admins || []).map((e) => e.toLowerCase());
    matches = mt.data.matches;
  } catch (e) {
    return err("Falha ao ler configuração: " + e.message, 502);
  }
  if (!admins.includes(email)) return err("Apenas administradores lançam resultados.", 403);

  const byId = new Map(matches.map((m) => [String(m.id), m]));
  const now = Date.now();
  const valid = {};
  for (const [id, r] of Object.entries(incoming)) {
    const match = byId.get(String(id));
    const h = cleanScore(r?.h);
    const a = cleanScore(r?.a);
    if (!match || match.placeholder || h === null || a === null) continue;
    if (now < Date.parse(match.kickoff)) continue;
    valid[String(id)] = { h, a };
  }
  if (!Object.keys(valid).length) return err("Nenhum resultado válido para salvar.");

  try {
    const results = await mutateJson(env, "data/results.json", () => ({ results: {} }), (d) => {
      d.results = d.results || {};
      Object.assign(d.results, valid);
    }, `Resultados lançados por ${email}`);
    return json({ results });
  } catch (e) {
    return err("Falha ao salvar: " + e.message, 502);
  }
}
