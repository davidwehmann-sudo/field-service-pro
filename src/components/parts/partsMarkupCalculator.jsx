/**
 * Calculate parts markup percentage using a smooth curve
 * Higher cost parts get lower markup percentages
 * 
 * Formula: markup = minMarkup + (maxMarkup - minMarkup) * e^(-cost/decayRate)
 * 
 * Default settings:
 * - Parts under $50: ~40% markup
 * - Parts around $100: ~30% markup
 * - Parts around $500: ~20% markup
 * - Parts over $1000: ~15% markup
 */
export function calculatePartsMarkup(unitCost, settings = null) {
  if (!unitCost || unitCost <= 0) return 25;
  
  const maxMarkup = settings?.max_markup ?? 45;  // Maximum markup % for very cheap parts
  const minMarkup = settings?.min_markup ?? 12;  // Minimum markup % for expensive parts
  const decayRate = settings?.decay_rate ?? 200; // How quickly markup decreases with cost
  
  // Smooth exponential decay curve
  const markup = minMarkup + (maxMarkup - minMarkup) * Math.exp(-unitCost / decayRate);
  
  return Math.round(markup * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate the total price with markup and shipping
 */
export function calculatePartTotal(unitCost, quantity, markupPercent, shippingCost = 0) {
  const cost = unitCost * quantity;
  const markup = cost * (markupPercent / 100);
  return cost + markup + shippingCost;
}