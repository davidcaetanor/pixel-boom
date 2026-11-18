/** Carrega texturas e sons e abre a partida. */
import Phaser from "phaser";
import { configureSound, loadSfx } from "../../audio/sfx.js";
import { registraFonteHud } from "../hud/pixel-text.js";
import {
  ANIMADAS,
  DIGITOS,
  QUADRO_ANIMADA,
  SEBE,
  ELENCO,
  FOLHA_PERSONAGEM,
  TEXTURA,
  caminhoDaFolha,
  caminhoDaTextura,
  chaveDoPersonagem,
} from "../atlas/atlas-registry.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "boot" });
  }

  preload(): void {
    loadSfx(this);
    for (const nome of Object.values(TEXTURA)) {
      this.load.image(nome, caminhoDaTextura(nome));
    }
    for (const nome of Object.values(ANIMADAS)) {
      this.load.spritesheet(nome, caminhoDaFolha(nome), { frameWidth: QUADRO_ANIMADA, frameHeight: QUADRO_ANIMADA });
    }
    for (const nome of SEBE.folhas) {
      this.load.spritesheet(nome, caminhoDaFolha(nome), { frameWidth: QUADRO_ANIMADA, frameHeight: QUADRO_ANIMADA });
    }
    this.load.spritesheet(DIGITOS.chave, caminhoDaFolha(DIGITOS.chave), {
      frameWidth: DIGITOS.larguraFrame,
      frameHeight: DIGITOS.alturaFrame,
    });
    ELENCO.forEach((_, character) => {
      const chave = chaveDoPersonagem(character);
      this.load.spritesheet(chave, caminhoDaFolha(chave), {
        frameWidth: FOLHA_PERSONAGEM.larguraFrame,
        frameHeight: FOLHA_PERSONAGEM.alturaFrame,
      });
    });
  }

  /** `?local` abre a partida offline; o padrao e o lobby da sala online. */
  create(): void {
    registraFonteHud(this);
    configureSound(this.sound);
    const local = new URLSearchParams(window.location.search).has("local");
    this.scene.start(local ? "match" : "lobby");
  }
}
