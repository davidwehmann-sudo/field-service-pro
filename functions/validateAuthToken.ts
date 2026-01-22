import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'No token provided' }, { status: 400 });
    }

    // Find the access token
    const tokens = await base44.asServiceRole.entities.AuthorizationAccessToken.filter({ 
      token,
      is_active: true 
    });

    if (tokens.length === 0) {
      return Response.json({ error: 'Invalid or expired authorization link' }, { status: 404 });
    }

    const accessToken = tokens[0];

    // Check if expired
    const expiryDate = new Date(accessToken.expires_at);
    if (expiryDate < new Date()) {
      return Response.json({ error: 'This authorization link has expired' }, { status: 410 });
    }

    // Get the authorization
    const authorization = await base44.asServiceRole.entities.PreRepairAuthorization.get(accessToken.authorization_id);
    
    if (!authorization) {
      return Response.json({ error: 'Authorization not found' }, { status: 404 });
    }

    // Check if already authorized
    if (authorization.status !== 'draft') {
      return Response.json({ error: 'This authorization has already been completed' }, { status: 400 });
    }

    // Get customer details
    const customer = await base44.asServiceRole.entities.Customer.get(authorization.customer_id);

    return Response.json({
      authorization,
      customer
    });

  } catch (error) {
    console.error('Validate token error:', error);
    return Response.json({ 
      error: 'An error occurred while loading the authorization' 
    }, { status: 500 });
  }
});