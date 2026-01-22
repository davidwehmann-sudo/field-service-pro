import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, spreadsheet_id, range } = await req.json();
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    if (action === 'list_spreadsheets') {
      // List spreadsheets from Google Drive
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name,modifiedTime)',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Google Drive error:', error);
        throw new Error('Failed to list spreadsheets');
      }

      const data = await response.json();
      return Response.json({ spreadsheets: data.files || [] });
    }

    if (action === 'get_sheet_data') {
      if (!spreadsheet_id) {
        return Response.json({ error: 'Spreadsheet ID required' }, { status: 400 });
      }

      // Get spreadsheet metadata to list sheets
      const metadataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!metadataResponse.ok) {
        const error = await metadataResponse.text();
        console.error('Google Sheets metadata error:', error);
        throw new Error('Failed to get spreadsheet metadata');
      }

      const metadata = await metadataResponse.json();
      const sheets = metadata.sheets?.map(s => s.properties.title) || [];

      // Get data from first sheet or specified range
      const dataRange = range || `${sheets[0]}!A1:Z1000`;
      const dataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(dataRange)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!dataResponse.ok) {
        const error = await dataResponse.text();
        console.error('Google Sheets data error:', error);
        throw new Error('Failed to get spreadsheet data');
      }

      const sheetData = await dataResponse.json();
      
      return Response.json({ 
        sheets,
        values: sheetData.values || [],
        range: dataRange
      });
    }

    if (action === 'import_data') {
      const { rows, column_mapping, customer_id } = await req.json();

      if (!rows || !column_mapping) {
        return Response.json({ error: 'Rows and column mapping required' }, { status: 400 });
      }

      const imported = [];
      const errors = [];

      for (const row of rows) {
        try {
          const serviceReport = {
            customer_id: customer_id || null,
            service_date: row[column_mapping.service_date] || new Date().toISOString().split('T')[0],
            equipment_type: row[column_mapping.equipment_type] || 'Unknown',
            equipment_make: row[column_mapping.equipment_make] || '',
            equipment_model: row[column_mapping.equipment_model] || '',
            equipment_serial: row[column_mapping.equipment_serial] || '',
            complaint: row[column_mapping.complaint] || '',
            work_performed: row[column_mapping.work_performed] || '',
            status: 'completed',
            notes: 'Imported from Google Sheets'
          };

          const created = await base44.asServiceRole.entities.ServiceReport.create(serviceReport);
          imported.push(created);
        } catch (error) {
          errors.push({ row, error: error.message });
        }
      }

      return Response.json({ 
        success: true,
        imported: imported.length,
        errors: errors.length,
        details: errors
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Google Sheets integration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});