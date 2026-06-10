import { mutateJson, json, err, requireToken, normEmail } from "./_lib.js";

// POST /api/join { poolId | newPoolName, email, name }
// Cria o bolão (se for o caso) e registra o participante com aceite das regras.
export async function onRequestPost({ request, env }) {
  const missing = requireToken(env);
  if (missing) return missing;

  let body;
  try { body = await request.json(); } catch { return err("Corpo inválido."); }

  const email = normEmail(body.email);
  const name = String(body.name || "").trim().slice(0, 30);
  if (!email) return err("E-mail inválido.");
  if (!name) return err("Informe um nome ou apelido.");

  let poolId = String(body.poolId || "").trim();
  const newPoolName = String(body.newPoolName || "").trim().slice(0, 40);
  if (newPoolName) {
    poolId = newPoolName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (!poolId) return err("Escolha um bolão ou dê um nome para o novo.");

  try {
    const pools = await mutateJson(env, "data/pools.json", () => ({ pools: {} }), (d) => {
      d.pools = d.pools || {};
      if (newPoolName && !d.pools[poolId]) {
        d.pools[poolId] = {
          name: newPoolName,
          createdBy: email,
          createdAt: new Date().toISOString(),
          members: {},
        };
      }
      const pool = d.pools[poolId];
      if (!pool) throw Object.assign(new Error("Bolão não encontrado."), { user: true });
      if (!pool.members[email]) {
        pool.members[email] = {
          name,
          acceptedRulesAt: new Date().toISOString(),
          predictions: {},
        };
      }
    }, `${name} entrou no bolão ${poolId}`);
    return json({ pools, poolId });
  } catch (e) {
    return err(e.user ? e.message : "Falha ao salvar: " + e.message, e.user ? 400 : 502);
  }
}
