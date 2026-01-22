import React, { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function SMSNotificationButton({ 
  invoice_id, 
  service_report_id, 
  customer_id,
  customerPhone,
  variant = 'ghost',
  size = 'icon'
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [messageType, setMessageType] = useState('custom');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  const messageTemplates = {
    technician_enroute: 'Our technician is on the way',
    service_complete: 'Your service has been completed',
    invoice_ready: 'Your invoice is ready',
    appointment_reminder: 'Appointment reminder'
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const payload = {
        invoice_id,
        service_report_id,
        customer_id,
        phone: customerPhone,
        type: messageType === 'custom' ? undefined : messageType,
        message: messageType === 'custom' ? customMessage : undefined
      };

      const response = await base44.functions.invoke('sendSMS', payload);
      
      if (response.data.success) {
        toast.success('SMS sent successfully!');
        setShowDialog(false);
        setCustomMessage('');
      } else {
        toast.error(response.data.error || 'Failed to send SMS');
      }
    } catch (error) {
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button 
        variant={variant}
        size={size}
        onClick={() => setShowDialog(true)}
        title="Send SMS notification"
      >
        <MessageSquare className="w-4 h-4" />
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send SMS Notification</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Message Type</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Message</SelectItem>
                  <SelectItem value="technician_enroute">Technician En Route</SelectItem>
                  <SelectItem value="service_complete">Service Complete</SelectItem>
                  <SelectItem value="invoice_ready">Invoice Ready</SelectItem>
                  <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageType === 'custom' ? (
              <div>
                <Label htmlFor="message">Custom Message</Label>
                <Textarea
                  id="message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                />
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  Preview: {messageTemplates[messageType]}
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSend}
                disabled={sending || (messageType === 'custom' && !customMessage.trim())}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}