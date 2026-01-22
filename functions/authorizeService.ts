import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, signature, authorization_date } = await req.json();

    if (!token || !signature) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find and validate the access token
    const tokens = await base44.asServiceRole.entities.AuthorizationAccessToken.filter({ 
      token,
      is_active: true 
    });

    if (tokens.length === 0) {
      return Response.json({ error: 'Invalid authorization link' }, { status: 404 });
    }

    const accessToken = tokens[0];

    // Check expiration
    const expiryDate = new Date(accessToken.expires_at);
    if (expiryDate < new Date()) {
      return Response.json({ error: 'Authorization link has expired' }, { status: 410 });
    }

    // Get authorization
    const authorization = await base44.asServiceRole.entities.PreRepairAuthorization.get(accessToken.authorization_id);
    
    if (!authorization) {
      return Response.json({ error: 'Authorization not found' }, { status: 404 });
    }

    if (authorization.status !== 'draft') {
      return Response.json({ error: 'Authorization already completed' }, { status: 400 });
    }

    // Update authorization with signature and status
    await base44.asServiceRole.entities.PreRepairAuthorization.update(authorization.id, {
      authorization_signature: signature,
      authorization_date: authorization_date,
      status: 'authorized'
    });

    // Create service report
    const serviceReport = await base44.asServiceRole.entities.ServiceReport.create({
      customer_id: authorization.customer_id,
      service_date: authorization_date,
      equipment_type: 'Other',
      equipment_make: '',
      equipment_model: '',
      equipment_serial: '',
      complaint: authorization.nature_of_service,
      service_items: [],
      destination_fee: {},
      status: 'draft'
    });

    // Link service report to authorization
    await base44.asServiceRole.entities.PreRepairAuthorization.update(authorization.id, {
      service_report_id: serviceReport.id,
      status: 'service_started'
    });

    // Deactivate the token
    await base44.asServiceRole.entities.AuthorizationAccessToken.update(accessToken.id, {
      is_active: false
    });

    // Send confirmation email
    if (authorization.billing_contact_email) {
      const customer = await base44.asServiceRole.entities.Customer.get(authorization.customer_id);
      const serviceTypeLabels = {
        check_and_advise: "Check & Advise",
        consultation: "Consultation",
        diagnostic: "Diagnostic",
        repair: "Repair",
        preventive_maintenance: "Preventive Maintenance",
        emergency_service: "Emergency Service"
      };
      
      const serviceTypeLabel = serviceTypeLabels[authorization.service_type] || authorization.service_type;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: authorization.billing_contact_email,
        subject: `Service Authorization Confirmed - ${customer?.company_name || 'Service'}`,
        body: `
Dear ${authorization.billing_contact_name},

Thank you for authorizing the service work. This email confirms your authorization.

AUTHORIZATION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Customer: ${customer?.company_name || 'N/A'}
Service Type: ${serviceTypeLabel}
${authorization.equipment_info ? `Equipment: ${authorization.equipment_info}` : ''}
Authorization Date: ${new Date(authorization_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
${authorization.estimated_cost ? `Estimated Cost: $${parseFloat(authorization.estimated_cost).toFixed(2)}${authorization.cost_is_ai_estimate ? ' (AI-generated estimate)' : ''}` : ''}

NATURE OF SERVICE:
${authorization.nature_of_service}

BILLING CONTACT:
${authorization.billing_contact_name}
${authorization.billing_contact_company || ''}
${authorization.billing_contact_phone || ''}
${authorization.billing_address ? `${authorization.billing_address}, ${authorization.billing_city}, ${authorization.billing_state} ${authorization.billing_zip}` : ''}

${authorization.notes ? `NOTES:
${authorization.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We'll begin work shortly and keep you updated on progress.

If you have any questions, please contact us.

Thank you for your business.
        `
      });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('Authorization error:', error);
    return Response.json({ 
      error: 'Failed to submit authorization' 
    }, { status: 500 });
  }
});