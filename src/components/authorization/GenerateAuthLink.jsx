import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Copy, Mail, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function GenerateAuthLink({ authorization, customer }) {
  const [showDialog, setShowDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Generate unique token
      const token = crypto.randomUUID();
      
      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
      
      // Create access token
      await base44.entities.AuthorizationAccessToken.create({
        authorization_id: authorization.id,
        token: token,
        expires_at: expiryDate.toISOString().split('T')[0],
        is_active: true
      });

      // Generate link
      const appUrl = window.location.origin;
      const link = `${appUrl}/authorize-service?token=${token}`;
      setGeneratedLink(link);
      
      toast.success('Authorization link generated');
    } catch (error) {
      toast.error('Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success('Link copied to clipboard');
  };

  const handleSendEmail = async () => {
    if (!authorization.billing_contact_email) {
      toast.error('No email address on file');
      return;
    }

    setSendingEmail(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: authorization.billing_contact_email,
        subject: `Action Required: Authorize Service Work - ${customer?.company_name || 'Service'}`,
        body: `
Dear ${authorization.billing_contact_name},

We need your authorization before beginning the following service work:

CUSTOMER: ${customer?.company_name || 'N/A'}
SERVICE TYPE: ${authorization.service_type?.replace(/_/g, ' ') || 'N/A'}
${authorization.equipment_info ? `EQUIPMENT: ${authorization.equipment_info}` : ''}
${authorization.estimated_cost ? `ESTIMATED COST: $${parseFloat(authorization.estimated_cost).toFixed(2)}` : ''}

DESCRIPTION:
${authorization.nature_of_service}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please click the link below to review and authorize this work:

${generatedLink}

This link will expire in ${expiryDays} days.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you have any questions before authorizing, please contact us.

Thank you.
        `
      });

      toast.success(`Authorization link sent to ${authorization.billing_contact_email}`);
      setShowDialog(false);
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Link2 className="w-4 h-4" />
        Generate Link
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Authorization Link</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Link expires in (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              />
            </div>

            {!generatedLink ? (
              <Button 
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Generate Secure Link
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700">Link generated successfully</p>
                </div>

                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Secure Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={generatedLink}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !authorization.billing_contact_email}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Email to {authorization.billing_contact_email || 'Customer'}
                      </>
                    )}
                  </Button>
                  {!authorization.billing_contact_email && (
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      No email address on file
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-500 text-center">
                  Link expires in {expiryDays} days
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}