import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { invoice_id, service_report_id, customer_id, type, phone, message } = await req.json();

    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioSid || !twilioToken || !twilioPhone) {
      return Response.json({ 
        success: false, 
        error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in secrets.' 
      }, { status: 400 });
    }

    let customerPhone = phone;
    let smsMessage = message;

    // Auto-generate message based on type
    if (!smsMessage) {
      const customers = await base44.asServiceRole.entities.Customer.list();
      let customer;

      if (customer_id) {
        customer = customers.find(c => c.id === customer_id);
      } else if (invoice_id) {
        const invoices = await base44.asServiceRole.entities.Invoice.list();
        const invoice = invoices.find(i => i.id === invoice_id);
        customer = customers.find(c => c.id === invoice?.customer_id);
      } else if (service_report_id) {
        const reports = await base44.asServiceRole.entities.ServiceReport.list();
        const report = reports.find(r => r.id === service_report_id);
        customer = customers.find(c => c.id === report?.customer_id);
      }

      if (!customer) {
        return Response.json({ error: 'Customer not found' }, { status: 404 });
      }

      customerPhone = customerPhone || customer.phone;

      // Generate message based on type
      switch (type) {
        case 'payment_received':
          const invoices = await base44.asServiceRole.entities.Invoice.list();
          const invoice = invoices.find(i => i.id === invoice_id);
          smsMessage = `Thank you for your payment! Invoice ${invoice?.invoice_number || invoice_id} has been paid in full. - DieselTech`;
          break;
        
        case 'invoice_ready':
          const inv = await base44.asServiceRole.entities.Invoice.list();
          const readyInv = inv.find(i => i.id === invoice_id);
          const payUrl = `${req.headers.get('origin')}/PayInvoice?invoice_id=${invoice_id}`;
          smsMessage = `Your invoice ${readyInv?.invoice_number || invoice_id} is ready. Total: $${readyInv?.total_amount?.toFixed(2) || '0.00'}. Pay online: ${payUrl} - DieselTech`;
          break;
        
        case 'service_complete':
          smsMessage = `Your service has been completed! We'll send your invoice shortly. Thank you for choosing DieselTech!`;
          break;
        
        case 'technician_enroute':
          smsMessage = `Our technician is on the way to your location. ETA: 30 minutes. - DieselTech`;
          break;
        
        case 'appointment_reminder':
          smsMessage = `Reminder: Your service appointment is scheduled for tomorrow. We'll see you then! - DieselTech`;
          break;
        
        default:
          smsMessage = message || 'Update from DieselTech Field Service';
      }
    }

    if (!customerPhone) {
      return Response.json({ 
        success: false, 
        error: 'No phone number provided or found for customer' 
      }, { status: 400 });
    }

    // Clean phone number
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const auth = btoa(`${twilioSid}:${twilioToken}`);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: twilioPhone,
        Body: smsMessage
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Twilio error:', error);
      return Response.json({ success: false, error: 'Failed to send SMS' }, { status: 500 });
    }

    const result = await response.json();
    
    return Response.json({ 
      success: true, 
      message_sid: result.sid,
      to: formattedPhone,
      message: smsMessage
    });
  } catch (error) {
    console.error('SMS error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});