/**
 * Ajustes de pagina para aparelho de toque: marca o documento com `is-touch`
 * para o CSS e, a cada toque fora da tela cheia, pede tela cheia e trava em
 * paisagem. O navegador so aceita os dois pedidos dentro de um gesto do
 * usuario, por isso nao ha como fazer isso ao carregar a pagina. No iPhone o
 * Safari nao tem tela cheia para pagina; o manifest cobre quem adiciona o
 * jogo a tela inicial.
 */
const TOQUE = "(pointer: coarse)";

interface LockableOrientation {
  lock?: (orientation: "landscape") => Promise<void>;
}

/**
 * iPhone aberto no Safari: a pagina nao tem tela cheia, so o jogo aberto pela
 * Tela de Inicio (o manifest abre em tela cheia e paisagem). O iPad tem tela
 * cheia de pagina e fica fora.
 */
export function needsHomeScreen(): boolean {
  const iphone = /iPhone|iPod/.test(navigator.userAgent);
  const instalado =
    window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iphone && !instalado && !document.fullscreenEnabled;
}

export function isTouchDevice(): boolean {
  return window.matchMedia(TOQUE).matches;
}

function inFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

function enterFullscreen(): void {
  if (inFullscreen() || !document.fullscreenEnabled) {
    return;
  }
  document.documentElement
    .requestFullscreen({ navigationUI: "hide" })
    .then(() => (screen.orientation as LockableOrientation).lock?.("landscape"))
    .catch(() => undefined);
}

export function prepareTouchScreen(): void {
  if (!isTouchDevice()) {
    return;
  }
  document.documentElement.classList.add("is-touch");
  // pointerup conta como gesto do usuario; pointerdown de toque nao conta.
  document.addEventListener("pointerup", enterFullscreen, { capture: true });
}
