/**
 * Placa do canto direito do topo com os atributos do proprio jogador: bombas,
 * alcance e o tempo do impulso de velocidade. Eliminado ou fora da rodada, a
 * mesma placa avisa que ele esta assistindo.
 */
import type Phaser from "phaser";
import { BALANCE, type Player } from "@pixelboom/shared";
import { TEXTURA } from "../atlas/atlas-registry.js";
import { TINT_PERIGO } from "../palette.js";
import { textoHud } from "./pixel-text.js";
import { CENTRO_MIOLO_TOPO, HUD_DEPTH, PLACA_PADDING_X, PLACA_TOPO_ALTURA, placa } from "./timer.js";
import { placaDireitaX } from "./top-layout.js";

const ESPACO_ITEM = 4;
const ESPACO_GRUPO = 12;
/** Topo da moldura da barra; o preenchimento fica 1 px para dentro. */
const BARRA_TOPO = 14;
const ALFA_SEM_IMPULSO = 0.35;
const TOPO_TEXTO = CENTRO_MIOLO_TOPO - 4;

type Peca = Phaser.GameObjects.Image | Phaser.GameObjects.BitmapText;

export class AttributesHud {
  private readonly fundo: Phaser.GameObjects.NineSlice;
  private readonly bomba: Phaser.GameObjects.Image;
  private readonly bombas: Phaser.GameObjects.BitmapText;
  private readonly fogo: Phaser.GameObjects.Image;
  private readonly alcance: Phaser.GameObjects.BitmapText;
  private readonly bota: Phaser.GameObjects.Image;
  private readonly moldura: Phaser.GameObjects.Image;
  private readonly preenchimento: Phaser.GameObjects.Image;
  private readonly eliminado: Phaser.GameObjects.BitmapText;
  private readonly assistindo: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene) {
    const imagem = (chave: string): Phaser.GameObjects.Image =>
      scene.add.image(0, 0, chave).setOrigin(0, 0).setDepth(HUD_DEPTH);
    const texto = (valor: string): Phaser.GameObjects.BitmapText => textoHud(scene, 0, 0, valor).setDepth(HUD_DEPTH);
    this.fundo = placa(scene);
    this.bomba = imagem(TEXTURA.uiIconeBomba);
    this.bombas = texto("");
    this.fogo = imagem(TEXTURA.uiIconeAlcance);
    this.alcance = texto("");
    this.bota = imagem(TEXTURA.uiIconeVelocidade);
    this.moldura = imagem(TEXTURA.uiBarraMoldura);
    this.preenchimento = imagem(TEXTURA.uiBarraPreenchimento);
    this.eliminado = texto("ELIMINADO").setTint(TINT_PERIGO);
    this.assistindo = texto("ASSISTINDO");
  }

  /** `self` ausente: o jogador entrou com a rodada em andamento. */
  render(self: Player | undefined, bordaDireitaRelogio: number): void {
    const jogando = self?.alive === true;
    for (const peca of [this.bomba, this.bombas, this.fogo, this.alcance, this.bota, this.moldura, this.preenchimento]) {
      peca.setVisible(jogando);
    }
    this.eliminado.setVisible(self !== undefined && !jogando);
    this.assistindo.setVisible(!jogando);

    let linha: (Peca | number)[];
    if (jogando) {
      this.bombas.setText(String(self.maxBombs));
      this.alcance.setText(String(self.range));
      const resto = Math.min(self.speedBoost / BALANCE.player.speedBoostSeconds, 1);
      this.preenchimento.setCrop(0, 0, Math.round(this.preenchimento.width * resto), this.preenchimento.height);
      this.bota.setAlpha(resto > 0 ? 1 : ALFA_SEM_IMPULSO);
      linha = [this.bomba, ESPACO_ITEM, this.bombas, ESPACO_GRUPO, this.fogo, ESPACO_ITEM, this.alcance, ESPACO_GRUPO, this.bota, ESPACO_ITEM, this.moldura];
    } else {
      linha = self === undefined ? [this.assistindo] : [this.eliminado, ESPACO_GRUPO, this.assistindo];
    }

    const largura = linha.reduce<number>((soma, p) => soma + (typeof p === "number" ? p : p.width), 0) + PLACA_PADDING_X * 2;
    const x = placaDireitaX(bordaDireitaRelogio, largura);
    this.fundo.setSize(largura, PLACA_TOPO_ALTURA).setPosition(x, 0);

    let cursor = x + PLACA_PADDING_X;
    for (const peca of linha) {
      if (typeof peca === "number") {
        cursor += peca;
        continue;
      }
      const y = peca === this.moldura ? BARRA_TOPO : "font" in peca ? TOPO_TEXTO : CENTRO_MIOLO_TOPO - Math.floor(peca.height / 2);
      peca.setPosition(cursor, y);
      cursor += peca.width;
    }
    this.preenchimento.setPosition(this.moldura.x + 1, BARRA_TOPO + 1);
  }
}
