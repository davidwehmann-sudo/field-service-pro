import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url, machine_model } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }

        console.log('Extracting parts from document:', file_url);

        // Use AI to extract parts information from the document
        const extractionResult = await base44.integrations.Core.InvokeLLM({
            prompt: `You are analyzing a parts diagram, parts list, or parts invoice document. Extract all part information visible in this document.

For each part found, extract:
- part_number: The manufacturer part number (required)
- part_description: A clear description of the part (required)
- source_details: The specific location in the document where this part is shown (e.g., "Item 23", "Page 3, Section B", "Line item 5")
- quantity: If this is an invoice/order, the quantity ordered (if visible)
- unit_cost: If this is an invoice/order, the unit cost (if visible)

IMPORTANT: 
- Only extract parts with clearly visible part numbers
- Be precise with part numbers - they must be exact
- Include ALL parts visible in the document
- For diagrams, use item numbers or callout numbers as source_details
- For invoices/lists, use line numbers or row numbers as source_details`,
            file_urls: [file_url],
            response_json_schema: {
                type: "object",
                properties: {
                    source_name: {
                        type: "string",
                        description: "The name/type of document (e.g., 'Parts Diagram', 'Service Manual', 'Supplier Invoice')"
                    },
                    parts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                part_number: { type: "string" },
                                part_description: { type: "string" },
                                source_details: { type: "string" },
                                quantity: { type: "number" },
                                unit_cost: { type: "number" }
                            },
                            required: ["part_number", "part_description", "source_details"]
                        }
                    }
                },
                required: ["source_name", "parts"]
            }
        });

        console.log('Extraction completed:', extractionResult);

        // Return the extracted parts with additional metadata
        return Response.json({
            success: true,
            source_name: extractionResult.source_name,
            photo_url: file_url,
            machine_model: machine_model || null,
            parts: extractionResult.parts || []
        });

    } catch (error) {
        console.error('Error extracting parts:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});