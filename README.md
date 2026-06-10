# ⚽ Bolão da Copa 2026

Site de bolão da Copa do Mundo 2026 para jogar entre amigos.
Sem banco de dados, sem anúncio: os palpites são salvos como JSON neste
próprio repositório, e o site roda de graça no **Cloudflare Pages**.

## Como funciona

- Site estático (`index.html`, `app.js`, `style.css`) + funções serverless em
  `functions/api/` (Cloudflare Pages Functions).
- O token do GitHub fica **só no servidor** (variável `GITHUB_TOKEN` no Cloudflare).
  Os amigos não precisam de token, conta no GitHub, nem senha — só e-mail.
- A trava de palpite (jogo já começou = fechado) é validada **no servidor**,
  com o relógio do servidor. Não dá para burlar pelo navegador.
- Dados:
  - `data/matches.json` — os 104 jogos (72 da fase de grupos confirmados, mata-mata "a definir").
  - `data/pools.json` — bolões, participantes e palpites.
  - `data/results.json` — placares oficiais (só administradores).
  - `data/config.json` — e-mails administradores.
- Todo salvamento vira um commit neste repositório → histórico auditável.
  Os commits de dados levam `[CI Skip]` na mensagem para não disparar deploy.

## Configuração (uma vez só, pelo organizador)

### 1. Regras do repositório no GitHub

Em **Settings → Rules → Rulesets** do repositório:

- ✅ **Block force pushes** — mantém o histórico imutável (anti-trapaça).
- ❌ **NÃO** marque "Require a pull request" — o servidor grava os palpites
  direto na `main`; essa regra quebra todos os salvamentos.

### 2. Criar o token do GitHub

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access**: *Only select repositories* → este repositório.
   (A opção "Public repositories" é SÓ LEITURA e não funciona.)
3. **Permissions** → *Repository permissions* → **Contents: Read and write**. Nada mais.
4. Validade: depois da final (ex.: 31/07/2026). Copie o `github_pat_...`.

Esse token não vai para o WhatsApp nem para o navegador de ninguém —
só para o passo seguinte.

### 3. Publicar no Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → escolha este repositório.
2. Build settings: framework **None**, build command **vazio**, output directory **/** (raiz). Deploy.
3. No projeto: **Settings → Variables and Secrets → Add**:
   - Nome: `GITHUB_TOKEN` · Tipo: **Secret** · Valor: o token do passo 2.
4. **Deployments → Retry deployment** (para o secret valer).
5. O site fica em `https://SEU-PROJETO.pages.dev` — manda o link no grupo. Pronto.

> O repositório/branch que as funções usam está em `functions/api/_lib.js`
> (`repoCfg`) — dá para sobrescrever com as variáveis `REPO_OWNER`,
> `REPO_NAME` e `REPO_BRANCH` no Cloudflare, sem mexer no código.

### 4. Definir administradores

Edite `data/config.json` com os e-mails de quem pode lançar os placares:

```json
{ "admins": ["voce@email.com"] }
```

## Uso pelos amigos

1. Abrir o link → escolher o bolão (ou criar um novo) → nome, e-mail, aceitar as regras.
2. Preencher os placares e tocar em **Salvar palpites**. Só isso.

## Regras (resumo)

| Acerto | Pontos |
|---|---|
| Placar exato | **10** |
| Vencedor/empate + saldo de gols | **7** |
| Só o vencedor/empate | **5** |
| Errou | **0** |

- Palpite trava no horário de início do jogo (validado no servidor).
- Palpites dos outros só aparecem depois que o jogo começa.
- Inscrição: **R$ 100,00** até uma semana antes da final.
- Pontuação e taxa configuráveis no topo de `app.js` (`POINTS`, `ENTRY_FEE`).

## Quando o mata-mata for definido

```bash
curl -o data/schedule-raw.json https://raw.githubusercontent.com/mjwebmaster/world-cup-2026-schedule-data/main/world-cup-2026-schedule.json
python tools/convert_schedule.py
git add data/ && git commit -m "mata-mata definido" && git push
```

Se a fonte não atualizar, edite `data/matches.json` na mão: troque `home`/`away`
pelos times classificados e mude `"placeholder": true` para `false`.
O push dispara um deploy novo no Cloudflare automaticamente.

## Segurança / limitações (de propósito, para manter simples)

- **Sem senha**: amigo pode salvar palpite usando o e-mail de outro.
  Histórico do git registra tudo com hora — trapaça aparece.
- **Trava de horário é firme**: validada no servidor; ninguém tem o token,
  então não existe caminho para alterar palpite depois do apito inicial.
- Resultados: só e-mails em `config.json`, e só de jogos já iniciados.
- Salvamentos simultâneos: o servidor tenta de novo sozinho (até 4x).

## Rodando localmente (para testar)

```bash
# completo (site + funções) — precisa de Node:
npx wrangler pages dev . --port 8789
# crie um arquivo .dev.vars com: GITHUB_TOKEN=seu_token (não vai para o git)

# só a interface, sem salvar:
python -m http.server 8000
```
