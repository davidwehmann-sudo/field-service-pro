import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function GeneratePortalLink({ customerId, customerName }) {
  const [showDialog, setShowDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await base44.functions.invoke('customerPortalAuth', {
        action: 'generate_token',
        customer_id: customerId
      });

      if (response.data.success) {
        setPortalUrl(response.data.portal_url);
        toast.success('Portal link generated!');
      } else {
        toast.error('Failed to generate link');
      }
    } catch (error) {
      toast.error('Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
      >
        <ExternalLink className="w-4 h-4 mr-1" />
        Portal Link
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Customer Portal Access</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Generate a secure access link for <strong>{customerName}</strong> to view their service history and submit requests.
            </p>

            {!portalUrl ? (
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {generating ? 'Generating...' : 'Generate Portal Link'}
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Secure Access Link (expires in 90 days)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={portalUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Security Note:</strong> This link provides secure access to the customer's service records. Share it only via secure channels (email, SMS).
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setShowDialog(false);
                    setPortalUrl('');
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}