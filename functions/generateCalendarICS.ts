import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { report_id } = await req.json();

    if (!report_id) {
      return Response.json({ error: 'Report ID required' }, { status: 400 });
    }

    // Fetch report and customer
    const report = await base44.entities.ServiceReport.get(report_id);
    const customer = await base44.entities.Customer.get(report.customer_id);

    // Parse service date
    const serviceDate = new Date(report.service_date);
    const startTime = new Date(serviceDate);
    startTime.setHours(8, 0, 0); // Default to 8 AM
    const endTime = new Date(startTime);
    endTime.setHours(17, 0, 0); // Default to 5 PM

    // Format dates for ICS (YYYYMMDDTHHMMSS)
    const formatICSDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    // Build description
    let description = `Service for ${customer.company_name || customer.contact_name}\\n\\n`;
    description += `Equipment: ${report.equipment_make} ${report.equipment_model} ${report.equipment_type}\\n`;
    if (report.equipment_serial) {
      description += `Serial: ${report.equipment_serial}\\n`;
    }
    if (report.complaint) {
      description += `\\nComplaint: ${report.complaint}\\n`;
    }
    if (customer.address) {
      description += `\\nLocation: ${customer.address}, ${customer.city}, ${customer.state}`;
    }

    // Build location
    let location = '';
    if (customer.address) {
      location = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip || ''}`;
    } else {
      location = customer.company_name || '';
    }

    // Create ICS content
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Field Service Pro//Service Report//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:service-${report.id}@fieldservicepro.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startTime)}
DTEND:${formatICSDate(endTime)}
SUMMARY:Service: ${customer.company_name || customer.contact_name}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
LOCATION:${location}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    // Return ICS file
    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename=service-${report.id.substring(0, 8)}.ics`
      }
    });
  } catch (error) {
    console.error('ICS generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});