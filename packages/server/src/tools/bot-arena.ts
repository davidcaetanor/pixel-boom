/**
 * Calibracao dos bots: muitas rodadas so de bots, sem rede nem render.
 * Uso: pnpm bot:arena [partidas] [dificuldades], ex.: pnpm bot:arena 200 hard,normal
 */
import { DeathCause, isBotDifficulty, playBotMatch } from "@pixelboom/shared";

const DEFAULT_MATCHES = 100;
const MS_PER_SECOND = 1000;

const matches = Number(process.argv[2] ?? DEFAULT_MATCHES);
const bots = (process.argv[3] ?? "hard,normal").split(",").filter(isBotDifficulty);

const wins = new Map<string, number>(bots.map((_, i) => [`bot${i}`, 0]));
const causes = new Map<string, number>();
let draws = 0;
let seconds = 0;
let crushed = 0;
let items = 0;
let decidedByItems = 0;
let richerWon = 0;
const started = performance.now();

for (let seed = 1; seed <= matches; seed += 1) {
  const report = playBotMatch(seed, bots);
  if (report.winnerId === null) {
    draws += 1;
  } else {
    wins.set(report.winnerId, (wins.get(report.winnerId) ?? 0) + 1);
  }
  for (const cause of Object.values(report.deaths)) {
    causes.set(cause, (causes.get(cause) ?? 0) + 1);
  }
  if (Object.values(report.deaths).includes(DeathCause.SuddenDeath)) {
    crushed += 1;
  }
  seconds += report.seconds;
  const counts = Object.values(report.pickups);
  items += counts.reduce((soma, n) => soma + n, 0);
  const most = Math.max(...counts);
  const leaders = Object.keys(report.pickups).filter((id) => report.pickups[id] === most);
  if (report.winnerId !== null && leaders.length === 1) {
    decidedByItems += 1;
    if (leaders[0] === report.winnerId) {
      richerWon += 1;
    }
  }
}

const lives = matches * bots.length;
const percent = (n: number, total: number): string => `${((100 * n) / total).toFixed(1)}%`;
const lines = [
  `partidas: ${matches} (${bots.join(" x ")})`,
  ...[...wins].map(([id, n]) => `vitorias ${id}: ${n} (${percent(n, matches)})`),
  `empates: ${draws} (${percent(draws, matches)})`,
  ...[...causes].map(([cause, n]) => `mortes ${cause}: ${n} (${percent(n, lives)} das vidas)`),
  `rodadas com morte pelo anel: ${crushed} (${percent(crushed, matches)})`,
  `itens por jogador por rodada: ${(items / lives).toFixed(1)}`,
  `quem pegou mais itens venceu: ${richerWon} de ${decidedByItems} (${percent(richerWon, Math.max(decidedByItems, 1))})`,
  `duracao media: ${(seconds / matches).toFixed(1)} s`,
  `custo: ${((performance.now() - started) / matches / MS_PER_SECOND).toFixed(2)} s por partida`,
];
process.stdout.write(`${lines.join("\n")}\n`);
