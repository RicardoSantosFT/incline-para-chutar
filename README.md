# Radar FC — Incline para Chutar ⚽

Minigame mobile-first de pênaltis controlado pelo **acelerômetro/giroscópio**: incline o celular para mirar o chute — ou para defender como goleiro. Visual no estilo do app Radar FC (navy escuro + verde neon + roxo), fiel à tela de referência "Incline para Chutar".

**🎮 Jogar no celular (giroscópio funciona):** https://ricardosantosft.github.io/incline-para-chutar/

> Importante: abra no **Safari/Chrome direto** (não em navegador embutido de app). Versões embutidas em iframe — como o visualizador de artifacts do claude.ai — não recebem permissão de sensores no iOS e caem no modo toque.

## Como jogar

| Modo | Objetivo | Controle |
|------|----------|----------|
| **Vamos chutar!** | 10 bolas. Mire nas zonas do gol (50 · 100 · 50) e bata. Mira instável desvia o chute; o goleiro rival mergulha. | Incline para mirar, toque em **CHUTAR!** |
| **Ser o goleiro** | 10 chutes do atacante rival, cada vez mais rápidos. Fique na frente da bola. | Incline para posicionar o goleiro |

- **Combo**: acertos em sequência multiplicam os pontos (até x5).
- **Precisão**: segure a mira parada (o arco da retícula fecha) para ganhar bônus.
- Sem giroscópio? O jogo cai automaticamente para **arrastar o dedo** (celular) ou **setas ← → + espaço** (desktop).
- Recordes ficam salvos no aparelho (localStorage).

## Duelo online (multiplayer)

Modo **Duelo online** no menu: crie uma sala, mande o convite (link ou código de 4 letras) e disputem pênaltis alternados — 5 bolas para cada um, morte súbita no empate, W.O. se alguém abandonar. A finta do goleiro e a paradinha do batedor viram guerra psicológica entre humanos.

- **Com Supabase (online de verdade):** preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `src/net/config.js` (Settings → API do projeto) e faça o deploy — o jogo usa canais do Supabase Realtime com um cliente próprio, sem SDK. Para testar sem redeploy, cole no console do navegador:
  `localStorage.setItem('iprachute:supabase:url', 'https://SEU.supabase.co')` e
  `localStorage.setItem('iprachute:supabase:key', 'eyJ…')`.
- **Sem Supabase:** o duelo funciona em modo local entre duas abas do mesmo aparelho (útil para testar).

## Rodar localmente

```bash
cd incline-para-chutar
python3 -m http.server 4173
# abra http://localhost:4173
```

Ou simplesmente abra `dist/index.html` com dois cliques (build single-file, funciona offline).

> **Sensores no celular exigem HTTPS.** Para testar a inclinação no aparelho, use a versão publicada como Artifact (link HTTPS) ou sirva com HTTPS. Em `http://` local o jogo funciona no modo toque.

## Desenvolvimento

```bash
npm test        # 43 testes da lógica pura (node:test, sem dependências)
npm run build   # gera dist/index.html (standalone) e dist/artifact.html
npm run serve   # servidor local na porta 4173
```

### Estrutura

```
src/
├── game/        # lógica pura testada: mira, zonas, chute, goleiro, placar
├── input/       # sensor deviceorientation + fallbacks (toque, teclado)
├── render/      # canvas 2D: estádio, gol, atores, efeitos
├── ui/          # HUD em DOM
├── audio.js     # SFX sintetizados com WebAudio (sem assets)
└── main.js      # máquina de estados e loop do jogo
```

A lógica de jogo é imutável e desacoplada do DOM/canvas — pronta para ser portada para o app Radar FC (React + Capacitor) como componente, reaproveitando `src/game/` inteiro.

## iOS: permissão de sensor

No iPhone (iOS 13+), o navegador exige permissão explícita: o jogo mostra o botão **"Ativar sensor"** no primeiro uso (gesto do usuário) e depois pede a calibração da posição neutra. Se negado, cai no modo toque.
