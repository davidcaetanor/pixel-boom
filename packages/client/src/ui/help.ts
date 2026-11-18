/** Conteudo de "Como jogar", usado no menu inicial e no menu de pausa. */
const CONTROLES: readonly (readonly [string, string])[] = [
  ["Setas ou WASD", "andar"],
  ["Espaco", "soltar bomba"],
];

const MELHORIAS: readonly (readonly [string, string])[] = [
  ["/powerup-bomba.png", "mais uma bomba"],
  ["/powerup-alcance.png", "explosao mais longa"],
  ["/powerup-velocidade.png", "mais velocidade"],
];

export function helpBody(): HTMLElement[] {
  const goal = document.createElement("p");
  goal.textContent = "Exploda caixas, pegue melhorias e seja o ultimo de pe.";

  const list = document.createElement("dl");
  list.className = "lobby-ajuda";
  for (const [keys, action] of CONTROLES) {
    const term = document.createElement("dt");
    term.textContent = keys;
    const desc = document.createElement("dd");
    desc.textContent = action;
    list.append(term, desc);
  }
  for (const [src, effect] of MELHORIAS) {
    const term = document.createElement("dt");
    const icon = document.createElement("img");
    icon.src = src;
    icon.alt = "";
    term.append(icon);
    const desc = document.createElement("dd");
    desc.textContent = effect;
    list.append(term, desc);
  }
  return [goal, list];
}
