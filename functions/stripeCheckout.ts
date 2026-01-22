import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return Response.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    // Fetch invoice details
    const invoices = await base44.asServiceRole.entities.Invoice.list();
    const invoice = invoices.find(i => i.id === invoice_id);

    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return Response.json({ error: 'Invoice already paid' }, { status: 400 });
    }

    // Fetch customer
    const customers = await base44.asServiceRole.entities.Customer.list();
    const customer = customers.find(c => c.id === invoice.customer_id);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice ${invoice.invoice_number || invoice.id}`,
              description: customer ? `Service for ${customer.company_name}` : 'Service Invoice',
            },
            unit_amount: Math.round((invoice.total_amount || 0) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/PayInvoice?invoice_id=${invoice_id}&success=true`,
      cancel_url: `${req.headers.get('origin')}/PayInvoice?invoice_id=${invoice_id}`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        invoice_id: invoice.id,
        customer_id: invoice.customer_id
      }
    });

    return Response.json({ checkout_url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});