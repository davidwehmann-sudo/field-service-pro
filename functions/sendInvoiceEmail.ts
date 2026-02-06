import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { invoice_id } = await req.json();

        if (!invoice_id) {
            return Response.json({ error: 'Invoice ID required' }, { status: 400 });
        }

        // Fetch data
        const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
        const customer = await base44.asServiceRole.entities.Customer.get(invoice.customer_id);
        const serviceReport = invoice.service_report_id 
            ? await base44.asServiceRole.entities.ServiceReport.get(invoice.service_report_id)
            : null;

        if (!customer.email) {
            return Response.json({ error: 'Customer has no email address' }, { status: 400 });
        }

        // Generate signature link if service report needs signature
        let signatureSection = '';
        if (serviceReport && !serviceReport.customer_signature) {
            const tokenData = {
                service_report_id: serviceReport.id,
                customer_email: customer.email,
                expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
            };
            const token = btoa(JSON.stringify(tokenData));
            const appUrl = 'https://' + req.headers.get('host');
            const signatureLink = `${appUrl}/sign-report?token=${encodeURIComponent(token)}`;
            
            signatureSection = `
                <div style="margin: 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                    <h3 style="color: #92400e; margin-top: 0;">📝 Service Report Signature Required</h3>
                    <p style="color: #78350f;">Please review and sign the service report for this work:</p>
                    <a href="${signatureLink}" style="display: inline-block; margin-top: 10px; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Review & Sign Service Report</a>
                    <p style="color: #78350f; font-size: 12px; margin-top: 10px;">This link expires in 7 days.</p>
                </div>
            `;
        }

        // Send email
        await base44.asServiceRole.integrations.Core.SendEmail({
            to: customer.email,
            subject: `Invoice #${invoice.invoice_number}`,
            body: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1e293b;">Invoice #${invoice.invoice_number}</h2>
                    <p>Dear ${customer.contact_name || customer.company_name},</p>
                    <p>Thank you for your business. Please find your invoice details below:</p>
                    
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0;"><strong>Invoice Date:</strong></td>
                                <td style="text-align: right;">${new Date(invoice.invoice_date).toLocaleDateString()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
                                <td style="text-align: right;">${new Date(invoice.due_date).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-top: 2px solid #e2e8f0;">
                                <td style="padding: 12px 0;"><strong style="font-size: 18px;">Amount Due:</strong></td>
                                <td style="text-align: right;"><strong style="font-size: 18px; color: #0f766e;">$${invoice.total_amount.toFixed(2)}</strong></td>
                            </tr>
                        </table>
                    </div>

                    ${signatureSection}

                    <p style="color: #64748b; font-size: 14px;">If you have any questions about this invoice, please don't hesitate to contact us.</p>
                    <p style="color: #64748b; font-size: 14px;">Thank you for your business!</p>
                </div>
            `
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Send invoice email error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});