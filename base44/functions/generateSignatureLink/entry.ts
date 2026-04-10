import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { service_report_id, customer_email } = await req.json();

        if (!service_report_id || !customer_email) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify the service report exists
        const report = await base44.asServiceRole.entities.ServiceReport.get(service_report_id);
        if (!report) {
            return Response.json({ error: 'Service report not found' }, { status: 404 });
        }

        // Generate a secure token (simple approach using base64)
        const tokenData = {
            service_report_id,
            customer_email,
            expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };
        const token = btoa(JSON.stringify(tokenData));

        // Get the app URL from the request
        const appUrl = new URL(req.url).origin;
        const signatureLink = `${appUrl}/sign-report?token=${encodeURIComponent(token)}`;

        // Send email with signature link
        await base44.asServiceRole.integrations.Core.SendEmail({
            to: customer_email,
            subject: 'Service Report - Signature Required',
            body: `
                <h2>Service Report Ready for Your Signature</h2>
                <p>Please review and sign your service report by clicking the link below:</p>
                <p><a href="${signatureLink}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 8px;">Review & Sign Report</a></p>
                <p>This link will expire in 7 days.</p>
                <p>If you have any questions, please contact us.</p>
            `
        });

        return Response.json({ 
            success: true, 
            signature_link: signatureLink 
        });
    } catch (error) {
        console.error('Error generating signature link:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});