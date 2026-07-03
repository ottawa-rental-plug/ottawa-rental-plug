// ORP — mortgage pre-qualification engine (Canadian GDS/TDS).
// Rough affordability estimate from earnings; NOT a lender commitment.
// Shared by apply.html (browser) and netlify/functions/apply.js (Node).
//
// GDS ≤ 39%: (mortgage P&I + property tax + heat + ½ condo fees) / gross income
// TDS ≤ 44%: GDS costs + all other monthly debt / gross income
// Max mortgage = present value of the max affordable payment, amortised at the
// qualifying (stress-test) rate.

(function (root) {
  // Ottawa-ish default assumptions — tune as rates/taxes move.
  var DEFAULTS = {
    rate: 0.0684,        // qualifying/stress-test rate (~contract + 2%, floor 5.25%)
    amortYears: 25,
    propertyTaxMo: 325,  // typical Ottawa monthly property tax
    heatMo: 150,
    gdsMax: 0.39,
    tdsMax: 0.44,
  };

  function prequalify(input) {
    input = input || {};
    var o = Object.assign({}, DEFAULTS, input);
    var income = Number(input.income) || 0;
    var monthlyDebts = Number(input.monthlyDebts) || 0;
    var downPayment = Number(input.downPayment) || 0;
    var grossMo = income / 12;
    if (grossMo <= 0) return null;

    var fixed = o.propertyTaxMo + o.heatMo;
    var gdsRoom = o.gdsMax * grossMo - fixed;
    var tdsRoom = o.tdsMax * grossMo - fixed - monthlyDebts;
    var maxPayment = Math.max(0, Math.min(gdsRoom, tdsRoom));

    var i = o.rate / 12, n = o.amortYears * 12;
    var maxMortgage = i > 0 ? maxPayment * (1 - Math.pow(1 + i, -n)) / i : maxPayment * n;

    // If no down payment given, assume ~10% down to sketch a purchase price.
    var maxPurchase = downPayment > 0 ? maxMortgage + downPayment : maxMortgage / 0.90;

    var band = maxMortgage >= 350000 ? 'Strong'
             : maxMortgage >= 200000 ? 'Moderate'
             : maxMortgage > 0       ? 'Building'
             : '—';

    return {
      grossMonthly:     Math.round(grossMo),
      maxMonthlyPayment: Math.round(maxPayment),
      maxMortgage:      Math.round(maxMortgage / 1000) * 1000,
      maxPurchase:      Math.round(maxPurchase / 5000) * 5000,
      downPayment:      downPayment,
      band:             band,
      limitedBy:        tdsRoom < gdsRoom ? 'TDS' : 'GDS',
    };
  }

  var api = { prequalify: prequalify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ORPPrequal = api;
})(typeof window !== 'undefined' ? window : null);
