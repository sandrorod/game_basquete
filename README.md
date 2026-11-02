# STREET BASKETBALL FIGHT

Beat 'em up 2D de fliperama com identidade própria: o **STREET PLAYER** atravessa 10 fases usando a bola de basquete como arma, contra gangues, rivais e 10 chefes.

Roda direto no navegador, em computador ou celular. É feito com HTML5, Canvas 2D e TypeScript, sem nenhuma imagem externa: personagens, cenários, efeitos e áudio são gerados por código.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # versão de produção em dist/ (site estático)
npm run preview    # serve o build
```

## Controles

| Ação | Computador | Celular |
|---|---|---|
| Andar (4 direções, com profundidade) | W A S D ou setas | analógico à esquerda |
| Correr | Shift, ou toque duplo na direção | RUN |
| Arremesso rápido (sem bola: empurrão) | Espaço | THROW |
| Arremesso forte (derruba, quebra defesa) | J | STRONG |
| Arremesso carregado (segure e solte) / SUPER SHOT com SP cheio | K | SP |
| Pausar | Esc | botão II |

## O que tem no jogo

- **10 fases diferentes**, cada uma com cenário próprio e camada de fundo com efeito de profundidade:
  1. The Old Streets
  2. The Subway (com o trem passando)
  3. The Industrial Zone (com jatos de vapor)
  4. The Beach
  5. The Night City (com carros e neon piscando)
  6. The Basketball Court
  7. The Chinatown
  8. The Underground (com carros)
  9. The Rooftop (com vãos e helicóptero)
  10. The Final Arena (com holofotes e público)
- **8 tipos de inimigo** com inteligência artificial própria:
  - Street Thug e Fast Runner (avança de repente);
  - Heavy Guy (tem armadura);
  - Ball Thief (rouba a bola e foge);
  - Street Shooter (mantém distância);
  - Defender (bloqueia arremessos rápidos);
  - Biker (atravessa a tela, avisa antes de voltar e cai da moto);
  - Street Basketball Player (arremessa bolas).

  Eles cercam o jogador sem se amontoar, e só alguns atacam de cada vez.
- **10 chefes** com estratégias próprias. Os golpes vêm de um conjunto (soco pesado, combo, investida, rajada de projéteis, salto com onda de choque, teletransporte, convocar capangas), e cada chefe tem passivas diferentes: esquiva, armadura que quebra e fúria abaixo de 35% de vida. THE KING luta em 3 fases.
- **Combate:**
  - a bola gira no ar e volta para a mão;
  - pausa de impacto e tremor de tela;
  - combos;
  - barra SP para o SUPER SHOT (5 bolas);
  - a sua bola rebate projéteis inimigos.
- **Obstáculos:** os quebráveis soltam comida, estrelas e 1UP. Os sólidos bloqueiam a passagem, mas nunca fecham a rua.
- **Pontuação e bônus:**
  - pontos por acertos, combos e objetos quebrados;
  - +500 ("PERFECT") por limpar uma onda sem levar dano;
  - no fim da fase: bônus de tempo, energia, combo e +5000 por vencer o chefe sem dano;
  - vidas extras com intervalo crescente.
- **Telas:** inicial, como jogar, opções (música e efeitos separados, dificuldade, controles de toque), pausa, GAME OVER e vitória.
- **Progresso salvo no navegador:** dá para continuar da fase desbloqueada.

## Testes

```bash
npm test           # testes unitários (lógica, colisão, controles, dados)
npm run dev        # em outro terminal, para o próximo comando
npm run test:e2e   # confere os 20 requisitos no Chrome real (teclado, toque, menus)
```

`tests/e2e/bot.js` é um robô que joga sozinho, controlando o jogo pelas mesmas entradas do teclado. Ele foi usado para confirmar que as 10 fases podem ser concluídas até a vitória e para ajustar a curva de dificuldade.

## Estrutura

```
src/
  core/     configuração, entradas (teclado/toque), áudio sintetizado, progresso salvo
  render/   lutadores com esqueleto articulado, poses/animações, cenários, objetos, efeitos, HUD
  game/     jogador, inimigos (IA), chefes, projéteis, obstáculos, fase (World) e máquina de estados (Game)
  data/     visual dos personagens, inimigos, chefes e as 10 fases
  ui/       menus (HTML) e controles de toque
tests/      unitários (Vitest) e checagem no navegador (tests/e2e)
```

Para criar uma nova fase, acrescente uma entrada em `src/data/stages.ts` (e um tema em `render/backgrounds.ts`, se for um cenário novo). Um inimigo novo vai em `data/enemies.ts` e `data/looks.ts`, e um chefe novo em `data/bosses.ts`.
