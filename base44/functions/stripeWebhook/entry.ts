import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    let event;
    if (webhookSecret) {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { invoice_id } = session.metadata;

      if (invoice_id) {
        // Update invoice to paid
        await base44.asServiceRole.entities.Invoice.update(invoice_id, {
          status: 'paid',
          payment_method: 'card',
          payment_date: new Date().toISOString().split('T')[0],
          payment_reference: session.payment_intent
        });

        console.log(`Invoice ${invoice_id} marked as paid`);
        
        // Send SMS confirmation via Twilio if available
        try {
          await base44.asServiceRole.functions.invoke('sendSMS', {
            invoice_id: invoice_id,
            type: 'payment_received'
          });
        } catch (err) {
          console.log('SMS notification skipped:', err.message);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
});