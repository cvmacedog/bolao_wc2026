/* Entrada do Worker (Cloudflare Workers com assets estáticos).
 * Reusa os mesmos handlers de functions/api/ — um único código para
 * os dois formatos de deploy (Pages ou Worker). */

import * as data from "../functions/api/data.js";
import * as join from "../functions/api/join.js";
import * as predictions from "../functions/api/predictions.js";
import * as results from "../functions/api/results.js";
import * as syncResults from "../functions/api/sync-results.js";

const routes = {
  "GET /api/data": (ctx) => data.onRequestGet(ctx),
  "POST /api/join": (ctx) => join.onRequestPost(ctx),
  "POST /api/predictions": (ctx) => predictions.onRequestPost(ctx),
  "POST /api/results": (ctx) => results.onRequestPost(ctx),
  "GET /api/sync-results": (ctx) => syncResults.onRequestGet(ctx),
  "POST /api/sync-results": (ctx) => syncResults.onRequestPost(ctx),
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const handler = routes[`${request.method} ${url.pathname}`];
    if (handler) return handler({ request, env });
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Rota não encontrada." }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
