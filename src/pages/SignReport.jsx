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

            setReport(reportData);
            setCustomer(customerData);
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
                        <p className="text-sm text-slate-600">
                            By signing below, you acknowledge that the work described above has been completed to your satisfaction.
                        </p>
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