import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { service_report_id, action } = await req.json();

    if (!service_report_id) {
      return Response.json({ error: 'Service report ID required' }, { status: 400 });
    }

    // Get access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Fetch service report
    const reports = await base44.asServiceRole.entities.ServiceReport.list();
    const report = reports.find(r => r.id === service_report_id);

    if (!report) {
      return Response.json({ error: 'Service report not found' }, { status: 404 });
    }

    // Fetch customer
    const customers = await base44.asServiceRole.entities.Customer.list();
    const customer = customers.find(c => c.id === report.customer_id);

    const eventTitle = `Service: ${customer?.company_name || 'Customer'} - ${report.equipment_type || 'Equipment'}`;
    const eventDescription = `Equipment: ${report.equipment_make || ''} ${report.equipment_model || ''}\nComplaint: ${report.complaint || 'N/A'}`;
    const location = customer ? `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}` : '';

    // Parse time entries to determine event duration
    let event;
    const timeEntries = report.time_entries || [];
    
    if (timeEntries.length > 0) {
      // Use time entries to create timed event
      const startTimes = timeEntries.map(e => new Date(e.start_time)).filter(d => !isNaN(d));
      const endTimes = timeEntries.map(e => new Date(e.end_time)).filter(d => !isNaN(d));
      
      if (startTimes.length > 0 && endTimes.length > 0) {
        const earliestStart = new Date(Math.min(...startTimes));
        const latestEnd = new Date(Math.max(...endTimes));
        
        event = {
          summary: eventTitle,
          description: eventDescription,
          location: location,
          start: {
            dateTime: earliestStart.toISOString(),
            timeZone: 'America/Chicago' // Default timezone - can be made configurable
          },
          end: {
            dateTime: latestEnd.toISOString(),
            timeZone: 'America/Chicago'
          }
        };
      } else {
        // Fallback to all-day if time parsing fails
        event = {
          summary: eventTitle,
          description: eventDescription,
          location: location,
          start: { date: report.service_date },
          end: { date: report.service_date }
        };
      }
    } else {
      // Create all-day event when no time entries
      event = {
        summary: eventTitle,
        description: eventDescription,
        location: location,
        start: { date: report.service_date },
        end: { date: report.service_date }
      };
    }

    if (action === 'delete' && report.calendar_event_id) {
      // Delete event
      const deleteResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${report.calendar_event_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete calendar event');
      }

      await base44.asServiceRole.entities.ServiceReport.update(service_report_id, {
        calendar_event_id: null
      });

      return Response.json({ success: true, action: 'deleted' });
    } else {
      // Create or update event
      let calendarResponse;
      
      if (report.calendar_event_id) {
        // Update existing event
        calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${report.calendar_event_id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event)
          }
        );
      } else {
        // Create new event
        calendarResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event)
          }
        );
      }

      if (!calendarResponse.ok) {
        const error = await calendarResponse.text();
        console.error('Google Calendar error:', error);
        throw new Error('Failed to sync with calendar');
      }

      const calendarEvent = await calendarResponse.json();

      // Save event ID to service report
      await base44.asServiceRole.entities.ServiceReport.update(service_report_id, {
        calendar_event_id: calendarEvent.id
      });

      return Response.json({ 
        success: true, 
        event_id: calendarEvent.id,
        action: report.calendar_event_id ? 'updated' : 'created'
      });
    }
  } catch (error) {
    console.error('Calendar sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});