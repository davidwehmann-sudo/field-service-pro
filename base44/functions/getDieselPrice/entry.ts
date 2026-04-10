import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get("EIA_API_KEY");
    // EIA series: Weekly U.S. No 2 Diesel Retail Prices
    const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${apiKey}&frequency=weekly&data[0]=value&facets[product][]=EPD2D&facets[duoarea][]=NUS&facets[series][]=EMD_EPD2D_PTE_NUS_DPG&sort[0][column]=period&sort[0][direction]=desc&length=1`;

    const res = await fetch(url);
    const json = await res.json();

    const latestEntry = json?.response?.data?.[0];
    if (!latestEntry) {
      return Response.json({ error: 'No data returned from EIA' }, { status: 502 });
    }

    return Response.json({
      price: parseFloat(latestEntry.value),
      period: latestEntry.period,
      unit: 'dollars per gallon'
    });
  } catch (error) {
    console.error('getDieselPrice error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});