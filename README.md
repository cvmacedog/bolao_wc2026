# ⚽ Bolão da Copa 2026

Site estático de bolão da Copa do Mundo 2026 para jogar entre amigos.
Sem servidor, sem banco de dados, sem anúncio: os palpites são salvos como
JSON dentro deste próprio repositório, e o site roda no GitHub Pages.

## Como funciona

- `data/matches.json` — os 104 jogos da Copa (72 da fase de grupos já confirmados,
  mata-mata como "a definir").
- `data/pools.json` — os bolões (grupos de amigos), participantes e palpites.
- `data/results.json` — placares oficiais, lançados pelo administrador.
- `data/config.json` — lista de e-mails administradores (quem pode lançar resultados).

O site lê esses arquivos e grava alterações via API do GitHub usando um
**token compartilhado** (a "chave de acesso" que cada amigo cola uma vez no
celular). Não tem login com senha: a identidade é o e-mail, na confiança. 🤝

## Configuração (uma vez só, pelo organizador)

### 1. Criar o repositório

> ⚠️ **GitHub Pages em repositório privado exige plano GitHub Pro.**
> Na conta gratuita, o repositório precisa ser **público** para o Pages funcionar.
> Como os dados são só palpites de futebol + e-mails, avalie se tudo bem ser público.
> Se quiser privado, assine o Pro ou hospede em outro lugar (Netlify/Vercel leem repositório privado de graça).

1. Crie o repositório no GitHub (ex.: `bolao-copa-2026`) e suba estes arquivos.
2. Em **Settings → Pages**, selecione *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O site fica em `https://SEU_USUARIO.github.io/bolao-copa-2026/`.

### 2. Apontar o site para o repositório

Edite o topo de [`app.js`](app.js):

```js
const REPO = {
  owner: "SEU_USUARIO",
  name: "bolao-copa-2026",
  branch: "main",
};
```

### 3. Criar o token (a "chave de acesso" do grupo)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access**: somente este repositório.
3. **Permissions**: `Contents` → **Read and write**. Nada mais.
4. Validade: até o fim da Copa (ex.: 90 dias).
5. Mande o token no grupo do WhatsApp. Cada amigo cola uma vez quando o site pedir
   (fica salvo no aparelho dele).

> O token só dá acesso a este repositório de bolão — se vazar, o estrago máximo é
> alguém bagunçar os palpites (e tudo fica no histórico do git para restaurar).

### 4. Definir administradores

Edite `data/config.json` com os e-mails de quem pode lançar os placares oficiais:

```json
{ "admins": ["voce@email.com"] }
```

## Uso pelos amigos

1. Abrir o site → escolher o bolão (ou criar um novo) → nome, e-mail, aceitar as regras.
2. Preencher os placares e tocar em **Salvar palpites**.
3. Na primeira gravação o site pede a chave de acesso (token) — colar e pronto.

## Regras (resumo)

| Acerto | Pontos |
|---|---|
| Placar exato | **10** |
| Vencedor/empate + saldo de gols | **7** |
| Só o vencedor/empate | **5** |
| Errou | **0** |

- Palpite trava no horário de início do jogo.
- Palpites dos outros só aparecem depois que o jogo começa.
- Inscrição: **R$ 100,00** até uma semana antes da final.
- Pontuação e taxa são configuráveis no topo de `app.js` (`POINTS`, `ENTRY_FEE`).

## Quando o mata-mata for definido

Os confrontos do mata-mata entram automaticamente quando você atualizar `data/matches.json`:

```bash
# baixe o schedule atualizado
curl -o data/schedule-raw.json https://raw.githubusercontent.com/mjwebmaster/world-cup-2026-schedule-data/main/world-cup-2026-schedule.json
python tools/convert_schedule.py
git add data/ && git commit -m "mata-mata definido" && git push
```

Se a fonte não atualizar, edite `data/matches.json` na mão: troque `home`/`away`
pelos times classificados e mude `"placeholder": true` para `false`.

## Limitações (de propósito, para manter simples)

- **Sem senha**: qualquer um com o token pode salvar como qualquer e-mail.
  É um bolão entre amigos — o histórico do git registra tudo, então trapaça aparece.
- A trava de horário é feita no navegador e na gravação, mas alguém com o token e
  conhecimento técnico conseguiria burlar via API. De novo: histórico do git denuncia.
- Dois amigos salvando no mesmo segundo: o site tenta de novo automaticamente (até 4x).

## Rodando localmente (para testar)

```bash
python -m http.server 8000
# abra http://localhost:8000
```
