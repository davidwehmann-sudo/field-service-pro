import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, token, customer_id } = await req.json();

    if (action === 'validate_token') {
      if (!token) {
        return Response.json({ valid: false, error: 'Token required' }, { status: 400 });
      }

      // Use service role to access CustomerAccessToken (admin-only entity)
      const tokens = await base44.asServiceRole.entities.CustomerAccessToken.filter({
        token: token,
        is_active: true
      });

      if (tokens.length === 0) {
        return Response.json({ valid: false, error: 'Invalid or expired token' }, { status: 401 });
      }

      const accessToken = tokens[0];
      
      // Check expiration if set
      if (accessToken.expires_at) {
        const expiryDate = new Date(accessToken.expires_at);
        if (expiryDate < new Date()) {
          return Response.json({ valid: false, error: 'Token expired' }, { status: 401 });
        }
      }

      // Get customer data
      const customers = await base44.asServiceRole.entities.Customer.filter({ 
        id: accessToken.customer_id 
      });

      if (customers.length === 0) {
        return Response.json({ valid: false, error: 'Customer not found' }, { status: 404 });
      }

      return Response.json({
        valid: true,
        customer: customers[0],
        customer_id: customers[0].id
      });
    }

    if (action === 'generate_token') {
      // Only admins can generate tokens
      const user = await base44.auth.me();
      
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }

      if (!customer_id) {
        return Response.json({ error: 'Customer ID required' }, { status: 400 });
      }

      // Generate secure random token
      const newToken = crypto.randomUUID();
      
      // Set expiration to 90 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      // Create token using service role
      const accessToken = await base44.asServiceRole.entities.CustomerAccessToken.create({
        customer_id: customer_id,
        token: newToken,
        expires_at: expiresAt.toISOString().split('T')[0],
        is_active: true
      });

      // Generate portal URL
      const portalUrl = `${req.headers.get('origin')}/CustomerPortal?token=${newToken}`;

      return Response.json({
        success: true,
        token: newToken,
        portal_url: portalUrl,
        expires_at: accessToken.expires_at
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Customer portal auth error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});