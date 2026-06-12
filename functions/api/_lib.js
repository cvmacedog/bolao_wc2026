/* Helpers compartilhados das funções (Cloudflare Pages Functions).
 * O token do GitHub fica APENAS aqui no servidor (variável GITHUB_TOKEN),
 * nunca no navegador dos participantes. */

const GH = "https://api.github.com";

export function repoCfg(env) {
  return {
    owner: env.REPO_OWNER || "cvmacedog",
    name: env.REPO_NAME || "bolao_wc2026",
    branch: env.REPO_BRANCH || "main",
  };
}

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "bolao-copa-2026",
    "Content-Type": "application/json",
  };
}

export async function ghGetJson(env, path) {
  const { owner, name, branch } = repoCfg(env);
  const r = await fetch(
    `${GH}/repos/${owner}/${name}/contents/${path}?ref=${branch}&t=${Date.now()}`,
    { headers: ghHeaders(env) },
  );
  if (r.status === 404) return { data: null, sha: null };
  if (!r.ok) {
    throw Object.assign(new Error(`GitHub GET ${path}: ${r.status}`), { status: r.status });
  }
  const j = await r.json();
  const bin = atob(j.content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return { data: JSON.parse(new TextDecoder().decode(bytes)), sha: j.sha };
}

export async function ghPutJson(env, path, data, sha, message) {
  const { owner, name, branch } = repoCfg(env);
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 1));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  // "[CI Skip]" impede que cada palpite dispare um novo deploy no Cloudflare Pages
  const body = { message: `[CI Skip] ${message}`, content: btoa(bin), branch };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH}/repos/${owner}/${name}/contents/${path}`, {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw Object.assign(new Error(`GitHub PUT ${path}: ${r.status}`), { status: r.status });
  }
}

// Lê, aplica a mutação e grava; repete em caso de conflito (salvamento simultâneo).
export async function mutateJson(env, path, fallback, mutator, message) {
  let lastErr;
  for (let i = 0; i < 4; i++) {
    const { data, sha } = await ghGetJson(env, path);
    const fresh = data || fallback();
    mutator(fresh);
    try {
      await ghPutJson(env, path, fresh, sha, message);
      return fresh;
    } catch (e) {
      lastErr = e;
      if (e.status !== 409 && e.status !== 422) throw e;
    }
  }
  throw lastErr;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export function requireToken(env) {
  if (!env.GITHUB_TOKEN) {
    return err("Servidor sem GITHUB_TOKEN configurado (Settings → Variables do projeto no Cloudflare).", 500);
  }
  return null;
}

export function normEmail(s) {
  const e = String(s || "").trim().toLowerCase();
  return e.includes("@") && e.length <= 80 ? e : null;
}

export function cleanScore(v) {
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  return n;
}
