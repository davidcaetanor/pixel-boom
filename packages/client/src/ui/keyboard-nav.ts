/**
 * Navegacao dos paineis pelas setas. A ordem e a do DOM; numa grade, cima e
 * baixo pulam uma linha e saem dela para o item antes ou depois. Nao conhece
 * nenhum painel especifico.
 */
export interface FocusGrid {
  readonly items: readonly HTMLElement[];
  readonly columns: number;
}

const STEPS: Readonly<Record<string, number>> = {
  ArrowUp: -1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
};

function usable(el: HTMLElement): boolean {
  return !el.hidden && !(el as HTMLButtonElement).disabled && el.offsetParent !== null;
}

/** Proximo item usavel a partir de `from`, andando `step` por vez, sem dar a volta. */
function walk(items: readonly HTMLElement[], from: number, step: number): HTMLElement | null {
  for (let i = from + step; i >= 0 && i < items.length; i += step) {
    const item = items[i];
    if (item !== undefined && usable(item)) {
      return item;
    }
  }
  return null;
}

/**
 * Move o foco conforme a seta pressionada e devolve true se a tecla foi usada.
 * Esquerda e direita dentro de um campo de texto ficam com o cursor do campo.
 */
export function moveFocus(event: KeyboardEvent, items: readonly HTMLElement[], grid?: FocusGrid): boolean {
  const step = STEPS[event.key];
  if (step === undefined) {
    return false;
  }
  const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
  const current = document.activeElement as HTMLElement | null;
  if (!vertical && current instanceof HTMLInputElement) {
    return false;
  }

  const index = current === null ? -1 : items.indexOf(current);
  let target: HTMLElement | null;
  if (index === -1) {
    target = walk(items, -1, 1);
  } else if (vertical && grid !== undefined && current !== null && grid.items.includes(current)) {
    const cell = grid.items.indexOf(current);
    const inGrid = walk(grid.items, cell, step * grid.columns);
    const edge = step < 0 ? grid.items[0] : grid.items[grid.items.length - 1];
    target = inGrid ?? walk(items, edge === undefined ? index : items.indexOf(edge), step);
  } else {
    target = walk(items, index, step);
  }

  if (target !== null) {
    event.preventDefault();
    target.focus();
  }
  return true;
}
