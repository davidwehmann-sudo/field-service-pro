import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customer_id, amount, shipping = 0 } = await req.json();

    if (!customer_id || !amount) {
      return Response.json({ 
        error: 'customer_id and amount are required' 
      }, { status: 400 });
    }

    // Get customer address
    const customer = await base44.entities.Customer.get(customer_id);
    
    if (!customer) {
      return Response.json({ 
        error: 'Customer not found' 
      }, { status: 404 });
    }

    // Validate required address fields
    if (!customer.address || !customer.city || !customer.state || !customer.zip) {
      return Response.json({ 
        success: false,
        error: 'Customer address is incomplete',
        tax_rate: 0,
        tax_amount: 0
      });
    }

    const taxjarApiKey = Deno.env.get('TAXJAR_API_KEY');
    
    if (!taxjarApiKey) {
      console.error('TAXJAR_API_KEY not configured');
      return Response.json({ 
        success: false,
        error: 'Tax calculation service not configured',
        tax_rate: 0,
        tax_amount: 0
      });
    }

    // Call TaxJar API with exponential backoff retry
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    let taxData;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const taxjarResponse = await fetch('https://api.taxjar.com/v2/taxes', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${taxjarApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from_country: 'US',
            from_zip: '68137', // Your business zip code - adjust as needed
            from_state: 'NE',
            from_city: 'Omaha',
            from_street: '',
            to_country: 'US',
            to_zip: customer.zip,
            to_state: customer.state,
            to_city: customer.city,
            to_street: customer.address,
            amount: amount,
            shipping: shipping,
            line_items: [{
              id: '1',
              quantity: 1,
              unit_price: amount,
              discount: 0
            }]
          })
        });

        if (!taxjarResponse.ok) {
          const errorText = await taxjarResponse.text();
          lastError = `TaxJar API error (${taxjarResponse.status}): ${errorText}`;
          console.error(lastError);
          
          // Don't retry on client errors (4xx)
          if (taxjarResponse.status >= 400 && taxjarResponse.status < 500) {
            break;
          }
          
          throw new Error(lastError);
        }

        taxData = await taxjarResponse.json();
        break; // Success - exit retry loop
        
      } catch (error) {
        lastError = error.message;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`TaxJar attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`TaxJar failed after ${maxRetries + 1} attempts:`, lastError);
        }
      }
    }

    if (!taxData) {
      return Response.json({ 
        success: false,
        error: 'Tax calculation service unavailable after retries',
        tax_rate: 0,
        tax_amount: 0
      });
    }
    
    return Response.json({
      success: true,
      tax_rate: (taxData.tax.rate * 100).toFixed(4), // Convert to percentage
      tax_amount: taxData.tax.amount_to_collect.toFixed(2),
      taxable_amount: taxData.tax.taxable_amount,
      breakdown: {
        state_tax: taxData.tax.breakdown?.state_taxable_amount || 0,
        county_tax: taxData.tax.breakdown?.county_taxable_amount || 0,
        city_tax: taxData.tax.breakdown?.city_taxable_amount || 0,
        special_tax: taxData.tax.breakdown?.special_taxable_amount || 0
      }
    });

  } catch (error) {
    console.error('Error calculating sales tax:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      tax_rate: 0,
      tax_amount: 0
    }, { status: 500 });
  }
});