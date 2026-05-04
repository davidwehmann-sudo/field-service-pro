import React from 'react';

export default function JobTotalsBar({ job }) {
  const sr = job.serviceReport;
  const parts = job.partsOrders || [];

  const laborTotal = (sr?.service_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
  const travelTotal = sr?.destination_fee?.total || 0;

  const partsTotal = parts.reduce((sum, p) => {
    const cost = (p.unit_cost || 0) * (p.quantity || 1);
    const shipping = p.shipping_cost || 0;
    const baseCost = cost + shipping;
    const markup = baseCost * ((p.markup_percent || 25) / 100);
    return sum + baseCost + markup;
  }, 0);

  const grandTotal = laborTotal + travelTotal + partsTotal;

  if (grandTotal === 0 && laborTotal === 0 && partsTotal === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
      <div className="text-center">
        <p className="text-slate-400 font-medium uppercase tracking-wide">Labor</p>
        <p className="font-semibold text-slate-700">${(laborTotal + travelTotal).toFixed(2)}</p>
      </div>
      <div className="text-center">
        <p className="text-slate-400 font-medium uppercase tracking-wide">Parts</p>
        <p className="font-semibold text-slate-700">${partsTotal.toFixed(2)}</p>
      </div>
      <div className="text-center sm:block hidden">
        <p className="text-slate-400 font-medium uppercase tracking-wide">Travel</p>
        <p className="font-semibold text-slate-700">${travelTotal.toFixed(2)}</p>
      </div>
      <div className="text-center">
        <p className="text-slate-400 font-medium uppercase tracking-wide">Total</p>
        <p className="font-bold text-green-700 text-sm">${grandTotal.toFixed(2)}</p>
      </div>
    </div>
  );
}