import { generateItemTooltip, getColorForItemType, itemTypeOptions } from '../utils/itemUtils';

test('maps every item type and falls back for unknown types', () => {
  itemTypeOptions.forEach(({ type, color }) => {
    expect(getColorForItemType(type)).toBe(color);
  });
  expect(getColorForItemType('Unknown')).toBe('item-type--other');
});

test('escapes user-controlled tooltip text while preserving trusted markup', () => {
  const payload = `<img src=x onerror=alert('unsafe')>&"`;
  const item = {
    name: payload,
    rarity: payload,
    type: 'Weapon',
    weight: payload,
    cost: payload,
    description: payload,
    weaponStats: { damage: payload, damageType: payload, properties: payload },
    magicProperties: payload,
    magicPropertiesVisible: true,
  };

  const html = generateItemTooltip(item);
  expect(html).toContain('class="item-tooltip"');
  expect(html).toContain('&lt;img src=x onerror=alert(&#39;unsafe&#39;)&gt;&amp;&quot;');
  expect(html).not.toContain(payload);
  expect(html).not.toContain('<img');
});

test('only reveals hidden magic properties to the DM', () => {
  const item = { name: 'Amulet', magicProperties: 'Secret', magicPropertiesVisible: false };

  expect(generateItemTooltip(item)).not.toContain('Secret');
  expect(generateItemTooltip(item, true)).toContain('Secret');
});