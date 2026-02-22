import { Container, Graphics, Text } from 'pixi.js';
import type { Card } from '@/types/card.types';
import { RARITY_COLORS } from '@shared/constants/cards';
import { colors, fonts, spacing } from '@/theme.ts';

export const CARD_WIDTH = 160;
export const CARD_HEIGHT = 230;
export const CARD_HEIGHT_COMPACT = 68;
const PADDING = 10;
const CONTENT_W = CARD_WIDTH - PADDING * 2;
const HP_BAR_H = 12;

/**
 * Visual representation of a game card as a Pixi Container.
 * Displays name, HP bar, ATK/DEF stats, description, rarity border.
 * Supports selected, dead, and highlighted states.
 */
export class CardSprite extends Container {
  private bg = new Graphics();
  private border = new Graphics();
  private nameText: Text;
  private hpText: Text;
  private hpBarBg = new Graphics();
  private hpBarFill = new Graphics();
  private atkText: Text;
  private defText: Text;
  private descText: Text;

  private deathOverlay = new Graphics();
  private deathLabel: Text;

  private selectBadge = new Graphics();
  private selectOrderText: Text;

  private _card: Card;
  private _isDead = false;
  private _isSelected = false;
  private _compact = false;

  constructor(card: Card) {
    super();
    this._card = card;

    // Background
    this.addChild(this.bg);

    // Border (drawn on top of bg)
    this.addChild(this.border);

    // Name
    this.nameText = new Text({
      text: '',
      style: { fontFamily: fonts.heading, fontSize: 14, fontWeight: 'bold', fill: 0xffffff },
    });
    this.nameText.position.set(PADDING, 8);
    this.addChild(this.nameText);

    // HP text
    this.hpText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: 13, fill: colors.hp },
    });
    this.hpText.position.set(PADDING, 30);
    this.addChild(this.hpText);

    // HP bar
    this.hpBarBg.position.set(PADDING, 48);
    this.addChild(this.hpBarBg);
    this.hpBarFill.position.set(PADDING, 48);
    this.addChild(this.hpBarFill);

    // ATK
    this.atkText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: 12, fill: colors.text },
    });
    this.atkText.position.set(PADDING, 66);
    this.addChild(this.atkText);

    // DEF
    this.defText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: 12, fill: colors.text },
    });
    this.defText.position.set(PADDING, 84);
    this.addChild(this.defText);

    // Description
    this.descText = new Text({
      text: '',
      style: {
        fontFamily: fonts.body,
        fontSize: 11,
        fontStyle: 'italic',
        fill: colors.text,
        wordWrap: true,
        wordWrapWidth: CONTENT_W,
      },
    });
    this.descText.alpha = 0.7;
    this.descText.position.set(PADDING, 104);
    this.addChild(this.descText);

    // Death overlay
    this.deathOverlay.visible = false;
    this.addChild(this.deathOverlay);

    this.deathLabel = new Text({
      text: 'DEAD',
      style: { fontFamily: fonts.heading, fontSize: 20, fontWeight: 'bold', fill: 0xff4444 },
    });
    this.deathLabel.anchor.set(0.5);
    this.deathLabel.position.set(CARD_WIDTH / 2, CARD_HEIGHT / 2);
    this.deathLabel.visible = false;
    this.addChild(this.deathLabel);

    // Selection badge
    this.selectBadge.visible = false;
    this.addChild(this.selectBadge);

    this.selectOrderText = new Text({
      text: '',
      style: { fontFamily: fonts.heading, fontSize: 14, fontWeight: 'bold', fill: 0xffffff },
    });
    this.selectOrderText.anchor.set(0.5);
    this.selectOrderText.visible = false;
    this.addChild(this.selectOrderText);

    this.draw();
  }

  get card(): Card { return this._card; }

  /** Update the card data and redraw. */
  updateCard(card: Card): void {
    this._card = card;
    this._isDead = card.isDead === true;
    this.draw();
  }

  /** Set the selected state with an optional order badge. */
  setSelected(selected: boolean, order = 0): void {
    this._isSelected = selected;
    this.selectBadge.visible = selected && order > 0;
    this.selectOrderText.visible = selected && order > 0;
    if (order > 0) {
      this.selectOrderText.text = String(order);
    }
    this.drawBorder();
    this.drawSelectBadge();
  }

  /** Set the dead state. */
  setDead(dead: boolean): void {
    this._isDead = dead;
    this.draw();
  }

  /** Toggle compact mode — hides description, shortens card height. */
  setCompact(compact: boolean): void {
    if (this._compact === compact) return;
    this._compact = compact;
    this.draw();
  }

  private getRarityColor(): number {
    const hex = RARITY_COLORS[this._card.rarity];
    if (!hex) return 0xB0A894;
    return parseInt(hex.replace('#', ''), 16);
  }

  private draw(): void {
    const rarityColor = this.getRarityColor();
    const card = this._card;
    const h = this._compact ? CARD_HEIGHT_COMPACT : CARD_HEIGHT;

    // Background
    this.bg.clear();
    this.bg.rect(0, 0, CARD_WIDTH, h);
    this.bg.fill({ color: colors.cardBg, alpha: colors.cardBgAlpha });

    // Border
    this.drawBorder();

    // Name
    this.nameText.text = card.name;
    this.nameText.style.fill = rarityColor;

    // HP text
    this.hpText.text = `HP: ${card.currentHp}/${card.maxHp}`;

    // HP bar
    const hpPct = Math.max(0, card.currentHp / card.maxHp);
    this.hpBarBg.clear();
    this.hpBarBg.rect(0, 0, CONTENT_W, HP_BAR_H);
    this.hpBarBg.fill({ color: colors.darkOverlay, alpha: 0.5 });

    this.hpBarFill.clear();
    if (hpPct > 0) {
      this.hpBarFill.rect(0, 0, CONTENT_W * hpPct, HP_BAR_H);
      this.hpBarFill.fill({ color: colors.hpBar });
    }

    // Stats (hidden in compact mode — dice totals already include mods)
    const fmtMod = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
    this.atkText.text = `ATK: ${fmtMod(card.attackMod)}`;
    this.defText.text = `DEF: ${fmtMod(card.defenseMod)}`;
    this.atkText.visible = !this._compact;
    this.defText.visible = !this._compact;

    // Description (hidden in compact mode)
    this.descText.text = card.description;
    this.descText.visible = !this._compact;

    // Death
    this.deathOverlay.clear();
    if (this._isDead) {
      this.deathOverlay.rect(0, 0, CARD_WIDTH, h);
      this.deathOverlay.fill({ color: 0x000000, alpha: 0.5 });
      this.deathOverlay.visible = true;
      this.deathLabel.visible = true;
      this.deathLabel.position.set(CARD_WIDTH / 2, h / 2);
    } else {
      this.deathOverlay.visible = false;
      this.deathLabel.visible = false;
    }
  }

  private drawBorder(): void {
    const rarityColor = this.getRarityColor();
    const borderColor = this._isSelected ? colors.focus : rarityColor;
    const borderW = this._isSelected ? 3 : 2;
    const h = this._compact ? CARD_HEIGHT_COMPACT : CARD_HEIGHT;

    this.border.clear();
    this.border.rect(0, 0, CARD_WIDTH, h);
    this.border.stroke({ color: borderColor, width: borderW });
  }

  private drawSelectBadge(): void {
    if (!this._isSelected) return;
    const cx = CARD_WIDTH - spacing.md;
    const cy = spacing.md;
    const r = 12;

    this.selectBadge.clear();
    this.selectBadge.circle(cx, cy, r);
    this.selectBadge.fill({ color: colors.focus });

    this.selectOrderText.position.set(cx, cy);
  }
}
