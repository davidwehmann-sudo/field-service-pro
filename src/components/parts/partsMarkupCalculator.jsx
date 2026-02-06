/**
 * Calculate parts markup percentage using a logistic sigmoid curve
 * Higher cost parts get lower markup percentages with smooth transition
 * 
 * Formula: markup = maxMarkup + (minMarkup - maxMarkup) / (1 + e^(-k * (cost - inflection)))
 * 
 * Default settings:
 * - minMarkup: 15% (floor for high-cost parts)
 * - maxMarkup: 40% (ceiling for low-cost parts)
 * - k: 0.01 (steepness - higher = sharper transition)
 * - inflection: 200 (cost midpoint where markup halves)
 */
export function calculatePartsMarkup(unitCost, settings = null) {
  const config = settings || {
    min_markup: 15,    // Floor % for high-cost parts
    max_markup: 40,    // Ceiling % for low-cost parts
    k: 0.01,           // Steepness (higher = sharper transition)
    inflection: 200    // Cost midpoint where markup halves
  };

  if (!unitCost || unitCost <= 0) return config.max_markup;  // Fallback for invalid/low costs

  // Logistic sigmoid (decreasing): Starts near max, asymptotes to min
  const markup = config.max_markup + (config.min_markup - config.max_markup) / 
                 (1 + Math.exp(-config.k * (unitCost - config.inflection)));

  return parseFloat(markup.toFixed(2));  // 2-decimal precision
}

/**
 * Calculate the total price with markup and shipping
 * Shipping is divided per unit and added before markup
 */
export function calculatePartTotal(unitCost, quantity, markupPercent, shippingCost = 0) {
  const shippingPerUnit = quantity > 0 ? shippingCost / quantity : 0;
  const adjustedUnitCost = unitCost + shippingPerUnit;
  const markedUpPrice = adjustedUnitCost * (1 + markupPercent / 100);
  return markedUpPrice * quantity;
}