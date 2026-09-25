import { describe, expect, it } from 'vitest';
import {
  BRAND,
  CATEGORIES,
  DELIVERY_STAGES,
  FOOD_CATEGORIES,
  ITEMS,
  STAGE_SHARE,
  bill,
  comboAlaCarteCents,
  etaMinutes,
  foodItem,
  itemsInCategory,
  stageAt,
  unitKcal,
  unitPrice,
} from './food.js';

describe('the menu', () => {
  it('has unique ids', () => {
    const ids = ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes every category, and every category has something in it', () => {
    expect(CATEGORIES.map((category) => category.id).sort()).toEqual([...FOOD_CATEGORIES].sort());
    for (const category of FOOD_CATEGORIES) {
      expect(itemsInCategory(category).length, category).toBeGreaterThan(0);
    }
  });

  it('is written in all three languages, item by item', () => {
    for (const item of ITEMS) {
      for (const locale of ['it', 'ru', 'en'] as const) {
        expect(item.name[locale], `${item.id}.name.${locale}`).toBeTruthy();
        expect(item.note[locale], `${item.id}.note.${locale}`).toBeTruthy();
      }
    }
  });

  it('points every extra and every combo part at an item that exists', () => {
    for (const item of ITEMS) {
      for (const extra of item.extras ?? []) {
        expect(foodItem(extra), `${item.id} → ${extra}`).not.toBeNull();
      }

      if (!item.combo) continue;
      for (const part of [item.combo.panino, item.combo.side, item.combo.drink]) {
        expect(foodItem(part), `${item.id} → ${part}`).not.toBeNull();
      }
    }
  });

  it('prices every combo below its parts — otherwise it is not a combo', () => {
    for (const item of ITEMS) {
      const alaCarte = comboAlaCarteCents(item);
      if (alaCarte === null) continue;
      expect(item.priceCents, item.id).toBeLessThan(alaCarte);
    }
  });
});

describe('pricing', () => {
  it('adds the size and the extras to the base price', () => {
    const plain = unitPrice({ itemId: 'patatine', quantity: 1 });
    const large = unitPrice({ itemId: 'patatine', quantity: 1, sizeId: 'L' });
    expect(large).toBe(plain + 110);

    const withCheese = unitPrice({
      itemId: 'neo-classic',
      quantity: 1,
      extraIds: ['extra-cheese'],
    });
    expect(withCheese).toBe(290 + 70);
  });

  it('ignores a size on an item that does not come in sizes', () => {
    expect(unitPrice({ itemId: 'espresso', quantity: 1, sizeId: 'L' })).toBe(110);
    expect(unitKcal({ itemId: 'espresso', quantity: 1, sizeId: 'L' })).toBe(2);
  });

  it('counts energy the same way it counts money', () => {
    expect(unitKcal({ itemId: 'patatine', quantity: 1, sizeId: 'M' })).toBe(320 + 110);
  });

  it('charges delivery below the threshold and not above it', () => {
    const small = bill([{ itemId: 'espresso', quantity: 1 }]);
    expect(small.deliveryCents).toBe(BRAND.deliveryFeeCents);

    const large = bill([{ itemId: 'menu-double', quantity: 3, sizeId: 'L' }]);
    expect(large.itemsCents).toBeGreaterThanOrEqual(BRAND.freeDeliveryFromCents);
    expect(large.deliveryCents).toBe(0);
  });

  it('charges nothing for delivery when the order is collected', () => {
    expect(bill([{ itemId: 'espresso', quantity: 1 }], false).deliveryCents).toBe(0);
  });

  it('charges nothing for an empty bag', () => {
    const empty = bill([]);
    expect(empty.totalCents).toBe(0);
    expect(empty.deliveryCents).toBe(0);
  });

  it('drops a line whose item is gone from the menu rather than failing the basket', () => {
    const result = bill([
      { itemId: 'no-such-item', quantity: 2 },
      { itemId: 'espresso', quantity: 1 },
    ]);
    expect(result.lines).toHaveLength(1);
    expect(result.itemsCents).toBe(110);
  });

  it('drops a line with no quantity', () => {
    expect(bill([{ itemId: 'espresso', quantity: 0 }]).lines).toHaveLength(0);
  });

  it('reports what a combo saved', () => {
    const result = bill([{ itemId: 'menu-double', quantity: 2 }]);
    const alaCarte = comboAlaCarteCents(foodItem('menu-double')!) ?? 0;
    expect(result.savedCents).toBe((alaCarte - 940) * 2);
  });

  it('multiplies quantity through the line', () => {
    const result = bill([{ itemId: 'cola', quantity: 3, sizeId: 'M' }]);
    expect(result.lines[0]?.totalCents).toBe((210 + 60) * 3);
    expect(result.lines[0]?.kcal).toBe((180 + 110) * 3);
  });
});

describe('delivery', () => {
  it('quotes longer for a bigger bag, but not proportionally', () => {
    const one = etaMinutes(bill([{ itemId: 'espresso', quantity: 1 }]));
    const many = etaMinutes(
      bill(Array.from({ length: 9 }, () => ({ itemId: 'espresso', quantity: 1 }))),
    );
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThan(one * 2);
  });

  it('splits the journey into shares that add up to one', () => {
    const total = DELIVERY_STAGES.reduce((sum, stage) => sum + STAGE_SHARE[stage], 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('walks the stages in order and never goes back', () => {
    let previous = -1;
    for (let step = 0; step <= 100; step += 1) {
      const index = DELIVERY_STAGES.indexOf(stageAt(step / 100));
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  it('starts as placed and ends as arrived', () => {
    expect(stageAt(0)).toBe('placed');
    expect(stageAt(1)).toBe('arrived');
    expect(stageAt(1.5)).toBe('arrived');
  });
});
