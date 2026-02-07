import React, { useState } from 'react';
import { useCart } from '../components/parts/CartContext';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Trash2, AlertTriangle, Package, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

export default function PartsCart() {
  const { cartItems, updateCartItem, removeFromCart, clearCart } = useCart();
  const queryClient = useQueryClient();
  const [assignmentType, setAssignmentType] = useState('inventory');
  const [jobId, setJobId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const submitOrderMutation = useMutation({
    mutationFn: async (orders) => {
      const batchId = `BATCH-${Date.now()}`;
      const promises = orders.map(order =>
        base44.entities.PartsOrder.create({
          ...order,
          submission_batch_id: batchId,
          order_date: new Date().toISOString().split('T')[0],
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] });
      clearCart();
      toast.success('Parts order submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit order: ' + error.message);
    },
  });

  const handleSubmitOrder = async () => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }



    if (assignmentType === 'service_report' && !jobId) {
      toast.error('Please select a job for service report assignment');
      return;
    }

    if ((assignmentType === 'counter_sale' || assignmentType === 'cash_sale') && !customerId) {
      toast.error('Please select a customer');
      return;
    }

    setSubmitting(true);

    const orders = cartItems.map(item => ({
      assignment_type: assignmentType,
      job_id: jobId || undefined,
      customer_id: customerId || undefined,
      part_number: item.part_number,
      part_description: item.part_description,
      quantity: item.quantity,
      unit_cost: item.unit_cost || 0,
      supplier: item.supplier || '',
      status: 'needed',
      verification_source: item.verification_source || 'Parts Library',
      verification_details: item.verification_details || 'Added from verified parts library',
      verification_photo_url: item.verification_photo_url,
      notes: item.notes || '',
    }));

    await submitOrderMutation.mutateAsync(orders);
    setSubmitting(false);
  };

  const totalCost = cartItems.reduce((sum, item) => sum + (item.unit_cost || 0) * item.quantity, 0);

  if (cartItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Parts Cart</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">Your cart is empty</p>
            <p className="text-slate-400 text-sm">Add parts from the Parts Library to get started</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Cart</h1>
          <p className="text-slate-600 text-sm mt-1">
            {cartItems.length} {cartItems.length === 1 ? 'part' : 'parts'} ready to order
          </p>
        </div>
        <Button variant="outline" onClick={clearCart}>
          Clear Cart
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <Card key={item.part_number}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.part_number}</h3>
                        <p className="text-sm text-slate-600">{item.part_description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.part_number)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>

                    {(!item.verification_source || !item.verification_details) && (
                      <Badge variant="destructive" className="mb-2">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Missing Verification
                      </Badge>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <Label className="text-xs text-slate-500">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartItem(item.part_number, {
                              quantity: parseInt(e.target.value) || 1,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      {item.unit_cost && (
                        <div>
                          <Label className="text-xs text-slate-500">Unit Cost</Label>
                          <Input
                            value={`$${item.unit_cost.toFixed(2)}`}
                            disabled
                            className="mt-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <Label className="text-xs text-slate-500">Notes (optional)</Label>
                      <Textarea
                        value={item.notes || ''}
                        onChange={(e) =>
                          updateCartItem(item.part_number, { notes: e.target.value })
                        }
                        placeholder="Add notes for this part..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Assignment Type</Label>
                <Select value={assignmentType} onValueChange={setAssignmentType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inventory">Inventory</SelectItem>
                    <SelectItem value="service_report">Service Report</SelectItem>
                    <SelectItem value="counter_sale">Counter Sale</SelectItem>
                    <SelectItem value="cash_sale">Cash Sale</SelectItem>
                    <SelectItem value="internal_vehicle">Internal Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {assignmentType === 'service_report' && (
                <div>
                  <Label>Job</Label>
                  <Select value={jobId} onValueChange={setJobId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.job_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(assignmentType === 'counter_sale' || assignmentType === 'cash_sale') && (
                <div>
                  <Label>Customer</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Total Parts</span>
                  <span className="font-medium">{cartItems.length}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Total Quantity</span>
                  <span className="font-medium">
                    {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                {totalCost > 0 && (
                  <div className="flex justify-between text-lg font-bold mt-3 pt-3 border-t">
                    <span>Estimated Cost</span>
                    <span>${totalCost.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmitOrder}
                disabled={submitting}
              >
                {submitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Submit Order
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}