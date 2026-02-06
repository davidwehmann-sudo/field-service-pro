import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SignaturePad from '@/components/ui/SignaturePad';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SignReport() {
    const [loading, setLoading] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [report, setReport] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [parts, setParts] = useState([]);
    const [signature, setSignature] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        validateToken();
    }, []);

    const validateToken = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            if (!token) {
                setTokenValid(false);
                setLoading(false);
                return;
            }

            // Decode token
            const tokenData = JSON.parse(atob(token));
            
            // Check expiration
            if (Date.now() > tokenData.expires) {
                toast.error('This signature link has expired');
                setTokenValid(false);
                setLoading(false);
                return;
            }

            // Fetch service report
            const reportData = await base44.entities.ServiceReport.get(tokenData.service_report_id);
            
            if (!reportData) {
                setTokenValid(false);
                setLoading(false);
                return;
            }

            // Check if already signed
            if (reportData.customer_signature) {
                setCompleted(true);
                setReport(reportData);
                setTokenValid(true);
                setLoading(false);
                return;
            }

            // Fetch customer
            const customerData = await base44.entities.Customer.get(reportData.customer_id);

            // Fetch associated parts
            const partsData = await base44.entities.PartsOrder.filter({
                service_report_id: tokenData.service_report_id
            });

            setReport(reportData);
            setCustomer(customerData);
            setParts(partsData || []);
            setTokenValid(true);
            setLoading(false);
        } catch (error) {
            console.error('Token validation error:', error);
            setTokenValid(false);
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!signature) {
            toast.error('Please provide your signature');
            return;
        }

        setSubmitting(true);
        try {
            await base44.entities.ServiceReport.update(report.id, {
                customer_signature: signature
            });

            setCompleted(true);
            toast.success('Thank you! Your signature has been recorded.');
        } catch (error) {
            console.error('Signature submission error:', error);
            toast.error('Failed to submit signature. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-4" />
                    <p className="text-slate-600">Verifying signature link...</p>
                </div>
            </div>
        );
    }

    if (!tokenValid) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
                        <p className="text-slate-600">
                            This signature link is invalid or has expired. Please contact us for assistance.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Signature Complete</h2>
                        <p className="text-slate-600">
                            Thank you! Your signature has been recorded for this service report.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 py-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <Card>
                    <CardHeader>
                        <CardTitle>Service Report - Signature Required</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm">
                            <p><span className="font-semibold">Customer:</span> {customer?.company_name}</p>
                            <p><span className="font-semibold">Service Date:</span> {new Date(report.service_date).toLocaleDateString()}</p>
                            <p><span className="font-semibold">Equipment:</span> {report.equipment_type} - {report.equipment_make} {report.equipment_model}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Work Performed */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Work Performed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-sm max-w-none">
                            <p className="whitespace-pre-wrap">{report.work_performed || 'No details provided'}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Pricing Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Service Charges</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Labor */}
                            {report.service_items && report.service_items.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-sm mb-2">Labor</h3>
                                    <div className="space-y-2">
                                        {report.service_items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span>{item.description} ({item.hours} hrs @ ${item.rate}/hr)</span>
                                                <span className="font-medium">${item.total?.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Travel/Destination Fee */}
                            {report.destination_fee && report.destination_fee.total > 0 && (
                                <div>
                                    <h3 className="font-semibold text-sm mb-2">Travel Charges</h3>
                                    <div className="space-y-2 text-sm">
                                        {report.destination_fee.mileage > 0 && (
                                            <div className="flex justify-between">
                                                <span>Mileage: {report.destination_fee.mileage} mi @ ${report.destination_fee.mileage_rate}/mi</span>
                                                <span>${(report.destination_fee.mileage * report.destination_fee.mileage_rate).toFixed(2)}</span>
                                            </div>
                                        )}
                                        {report.destination_fee.travel_hours > 0 && (
                                            <div className="flex justify-between">
                                                <span>Travel Time: {report.destination_fee.travel_hours} hrs @ ${report.destination_fee.travel_rate}/hr</span>
                                                <span>${(report.destination_fee.travel_hours * report.destination_fee.travel_rate).toFixed(2)}</span>
                                            </div>
                                        )}
                                        {report.destination_fee.condition_surcharge > 0 && (
                                            <div className="flex justify-between">
                                                <span>Location Condition: {report.destination_fee.location_condition}</span>
                                                <span>${report.destination_fee.condition_surcharge.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-medium pt-2 border-t">
                                            <span>Travel Total</span>
                                            <span>${report.destination_fee.total?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Parts */}
                            {parts.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-sm mb-2">Parts</h3>
                                    <div className="space-y-2">
                                        {parts.map((part, idx) => {
                                            const unitCostWithShipping = part.unit_cost + (part.shipping_cost || 0) / part.quantity;
                                            const markedUpPrice = unitCostWithShipping * (1 + (part.markup_percent || 0) / 100);
                                            const total = markedUpPrice * part.quantity;
                                            return (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span>{part.part_description} (Qty: {part.quantity})</span>
                                                    <span className="font-medium">${total.toFixed(2)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Total */}
                            <div className="pt-4 border-t-2 border-slate-300">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total Amount</span>
                                    <span className="text-amber-600">
                                        ${(() => {
                                            const laborTotal = report.service_items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
                                            const travelTotal = report.destination_fee?.total || 0;
                                            const partsTotal = parts.reduce((sum, part) => {
                                                const unitCostWithShipping = part.unit_cost + (part.shipping_cost || 0) / part.quantity;
                                                const markedUpPrice = unitCostWithShipping * (1 + (part.markup_percent || 0) / 100);
                                                return sum + (markedUpPrice * part.quantity);
                                            }, 0);
                                            return (laborTotal + travelTotal + partsTotal).toFixed(2);
                                        })()}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    * Sales tax may be added based on your location and exemption status
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Photos */}
                {report.photos?.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Service Photos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {report.photos.map((photo, idx) => (
                                    <img 
                                        key={idx} 
                                        src={photo} 
                                        alt={`Service photo ${idx + 1}`}
                                        className="rounded-lg border w-full h-32 object-cover"
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Signature */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Your Signature</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                            <p className="text-sm font-semibold text-amber-900 mb-2">
                                Important: Review Charges Before Signing
                            </p>
                            <p className="text-sm text-amber-800">
                                By signing below, you acknowledge that:
                            </p>
                            <ul className="text-sm text-amber-800 list-disc list-inside mt-2 space-y-1">
                                <li>The work described above has been completed</li>
                                <li>You have reviewed and accept the service charges listed</li>
                                <li>You agree to pay the total amount shown</li>
                            </ul>
                        </div>
                        <SignaturePad 
                            value={signature}
                            onChange={setSignature}
                        />
                        <Button 
                            onClick={handleSubmit}
                            disabled={!signature || submitting}
                            className="w-full bg-amber-500 hover:bg-amber-600"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Signature'
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}