export const itemTypeOptions = [
  { type: 'Weapon', color: 'item-type--weapon' },
  { type: 'Armor', color: 'item-type--armor' },
  { type: 'Potion', color: 'item-type--potion' },
  { type: 'Magic', color: 'item-type--magic' },
  { type: 'Treasure', color: 'item-type--treasure' },
  { type: 'Gear', color: 'item-type--gear' },
  { type: 'Ammunition', color: 'item-type--ammunition' },
  { type: 'Tool', color: 'item-type--tool' },
  { type: 'Other', color: 'item-type--other' },
];

/**
 * Gives the background class associated with the item type
 * @param {string} type The type of the item
 * @returns {string} The background class for the item type, or `item-type--other` if unknown
 */
export function getColorForItemType(type) {
  const option = itemTypeOptions.find(opt => opt.type === type);
  return option ? option.color : 'item-type--other';
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

/**
 * Generates the HTML content for an item's tooltip.
 * @param {object} item - The item object.
 * @param {boolean} [isViewerDM=false] - Whether the person viewing the tooltip is the DM.
 * @returns {string} The HTML string for the tooltip.
 */
export const generateItemTooltip = (item, isViewerDM = false) => {
  if (!item) return '';

  const rarityColor = {
    Common: 'item-tooltip__rarity--common',
    Uncommon: 'item-tooltip__rarity--uncommon',
    Rare: 'item-tooltip__rarity--rare',
    'Very Rare': 'item-tooltip__rarity--very-rare',
    Legendary: 'item-tooltip__rarity--legendary',
    Artifact: 'item-tooltip__rarity--artifact',
  };

  let tooltipHtml = `<div class="item-tooltip">`;
  tooltipHtml += `<h4 class="item-tooltip__title">${escapeHtml(item.name)}</h4>`;
  tooltipHtml += `<p class="${rarityColor[item.rarity] || 'item-tooltip__rarity--common'}">${escapeHtml(item.rarity || 'Common')}</p>`;
  
  if (item.attunement === 'Yes') {
    tooltipHtml += `<p class="item-tooltip__attunement">Requires Attunement</p>`;
  }

  tooltipHtml += `<hr class="item-tooltip__divider">`;

  // Item Type and Weight/Cost
  let details = [];
  if (item.type) details.push(escapeHtml(item.type));
  if (item.weight) details.push(escapeHtml(item.weight));
  if (item.cost) details.push(escapeHtml(item.cost));
  if (details.length > 0) {
    tooltipHtml += `<p class="item-tooltip__details">${details.join(' | ')}</p>`;
  }

  // Weapon Stats
  if (item.type === 'Weapon' && item.weaponStats) {
    const { damage, damageType, properties } = item.weaponStats;
    if (damage || damageType || properties) {
      tooltipHtml += `<div class="item-tooltip__stats">`;
      if (damage) tooltipHtml += `<p><strong>Damage:</strong> ${escapeHtml(damage)} ${escapeHtml(damageType || '')}</p>`;
      if (properties) tooltipHtml += `<p><strong>Properties:</strong> ${escapeHtml(properties)}</p>`;
      tooltipHtml += `</div>`;
    }
  }

  // Armor Stats
  if (item.type === 'Armor' && item.armorStats) {
    const { armorClass, armorType, strengthRequirement, stealthDisadvantage } = item.armorStats;
    if (armorClass) {
      tooltipHtml += `<p class="item-tooltip__stat"><strong>Armor Class:</strong> ${escapeHtml(armorClass)}</p>`;
    }
    let armorDetails = [];
    if (armorType) armorDetails.push(escapeHtml(armorType));
    if (strengthRequirement > 0) armorDetails.push(`Str ${escapeHtml(strengthRequirement)}`);
    if (stealthDisadvantage) armorDetails.push('Stealth Disadvantage');
    if (armorDetails.length > 0) {
      tooltipHtml += `<p class="item-tooltip__details">${armorDetails.join(', ')}</p>`;
    }
  }

  // Description
  if (item.description) {
    tooltipHtml += `<p class="item-tooltip__description">${escapeHtml(item.description)}</p>`;
  }

  // Magic Properties
  if (item.magicProperties && (isViewerDM || item.magicPropertiesVisible)) {
    tooltipHtml += `<hr class="item-tooltip__divider item-tooltip__divider--magic">`;
    tooltipHtml += `<div class="item-tooltip__magic">`;
    tooltipHtml += `<p class="item-tooltip__magic-title">Magic Properties</p>`;
    tooltipHtml += `<p class="item-tooltip__magic-text">${escapeHtml(item.magicProperties)}</p>`;
    if (isViewerDM && !item.magicPropertiesVisible) {
      tooltipHtml += `<p class="item-tooltip__magic-hidden">(Hidden from player)</p>`;
    }
    tooltipHtml += `</div>`;
  }

  tooltipHtml += `</div>`;
  return tooltipHtml;
};