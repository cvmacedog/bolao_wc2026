import { ghGetJson, json, err, requireToken } from "./_lib.js";

// GET /api/data → bolões + resultados, sempre frescos direto do GitHub
export async function onRequestGet({ env }) {
  const missing = requireToken(env);
  if (missing) return missing;
  try {
    const [p, r] = await Promise.all([
      ghGetJson(env, "data/pools.json"),
      ghGetJson(env, "data/results.json"),
    ]);
    return json({
      pools: p.data || { pools: {} },
      results: r.data || { results: {} },
    });
  } catch (e) {
    return err("Falha ao ler dados no GitHub: " + e.message, 502);
  }
}
