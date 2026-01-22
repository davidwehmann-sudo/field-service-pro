import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function UploadAuthorizationForm({ customers, onAuthCreated }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setExtracting(false);

    try {
      // Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setUploading(false);
      setExtracting(true);

      // Extract data using AI
      const extractionSchema = {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          contact_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          billing_contact_name: { type: "string" },
          billing_contact_company: { type: "string" },
          billing_contact_phone: { type: "string" },
          billing_contact_email: { type: "string" },
          billing_address: { type: "string" },
          billing_city: { type: "string" },
          billing_state: { type: "string" },
          billing_zip: { type: "string" },
          on_site_contact_name: { type: "string" },
          on_site_contact_phone: { type: "string" },
          service_type: { 
            type: "string",
            enum: ["check_and_advise", "consultation", "diagnostic", "repair", "preventive_maintenance", "emergency_service"]
          },
          equipment_info: { type: "string" },
          nature_of_service: { type: "string" },
          estimated_cost: { type: "number" },
          authorization_date: { type: "string" }
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (result.status === 'error') {
        throw new Error(result.details || 'Failed to extract data');
      }

      const extractedData = result.output;

      // Find or create customer
      let customerId;
      const existingCustomer = customers.find(c => 
        c.company_name?.toLowerCase() === extractedData.customer_name?.toLowerCase()
      );

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else if (extractedData.customer_name) {
        const newCustomer = await base44.entities.Customer.create({
          company_name: extractedData.customer_name,
          contact_name: extractedData.contact_name,
          phone: extractedData.phone,
          email: extractedData.email
        });
        customerId = newCustomer.id;
      } else {
        throw new Error('Customer name not found in form');
      }

      // Create authorization
      const authData = {
        customer_id: customerId,
        billing_contact_name: extractedData.billing_contact_name || extractedData.contact_name,
        billing_contact_company: extractedData.billing_contact_company,
        billing_contact_phone: extractedData.billing_contact_phone || extractedData.phone,
        billing_contact_email: extractedData.billing_contact_email || extractedData.email,
        billing_address: extractedData.billing_address,
        billing_city: extractedData.billing_city,
        billing_state: extractedData.billing_state,
        billing_zip: extractedData.billing_zip,
        on_site_contact_name: extractedData.on_site_contact_name,
        on_site_contact_phone: extractedData.on_site_contact_phone,
        service_type: extractedData.service_type,
        equipment_info: extractedData.equipment_info,
        nature_of_service: extractedData.nature_of_service,
        estimated_cost: extractedData.estimated_cost,
        authorization_date: extractedData.authorization_date || new Date().toISOString().split('T')[0],
        status: 'authorized'
      };

      await base44.entities.PreRepairAuthorization.create(authData);

      toast.success('Authorization created from uploaded form!');
      setOpen(false);
      onAuthCreated();

    } catch (error) {
      console.error('Upload/extract error:', error);
      toast.error(error.message || 'Failed to process form');
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Upload className="w-4 h-4" />
        Upload Form
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Authorization Form</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Upload a scanned or photographed authorization form. AI will extract the information automatically.
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              {uploading || extracting ? (
                <div className="space-y-3">
                  <Loader2 className="w-8 h-8 mx-auto text-amber-500 animate-spin" />
                  <p className="text-sm text-slate-600">
                    {uploading && 'Uploading...'}
                    {extracting && 'Extracting data with AI...'}
                  </p>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF, PNG, or JPG (max 10MB)
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}