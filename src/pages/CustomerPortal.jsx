import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Wrench, 
  FileText, 
  MessageSquare, 
  Plus, 
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Loader2,
  Filter
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerAuthorizationForm from '@/components/customer/CustomerAuthorizationForm';
import ChatWindow from '@/components/customer/ChatWindow';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function CustomerPortal() {
  const [customerId, setCustomerId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showNewAuthForm, setShowNewAuthForm] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [filterEquipment, setFilterEquipment] = useState('all');
  const [sortBy, setSortBy] = useState('-service_date');

  const { data: authorizations = [], refetch: refetchAuthorizations } = useQuery({
    queryKey: ['customer-authorizations', customerId],
    queryFn: () => base44.entities.PreRepairAuthorization.filter({ customer_id: customerId }, '-created_date'),
    enabled: isAuthenticated && !!customerId,
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['customer-service-reports', customerId],
    queryFn: () => base44.entities.ServiceReport.filter({ customer_id: customerId }, sortBy),
    enabled: isAuthenticated && !!customerId,
  });

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ['customer-unread-messages', customerId],
    queryFn: async () => {
      const msgs = await base44.entities.ChatMessage.filter({
        customer_id: customerId,
        sender_type: 'technician',
        read_by_customer: false
      });
      return msgs.length;
    },
    enabled: isAuthenticated && !!customerId,
    refetchInterval: 5000,
  });

  const handleLogin = async () => {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
      alert('Invalid access link. Please use the link provided by your technician.');
      return;
    }
    
    setIsAuthenticating(true);
    try {
      const tokens = await base44.entities.CustomerAccessToken.filter({ 
        token: token,
        is_active: true 
      });
      
      if (tokens.length > 0) {
        const accessToken = tokens[0];
        const customers = await base44.entities.Customer.filter({ id: accessToken.customer_id });
        
        if (customers.length > 0) {
          setCustomer(customers[0]);
          setCustomerId(customers[0].id);
          setIsAuthenticated(true);
          localStorage.setItem('customerPortalToken', token);
        }
      } else {
        alert('Invalid or expired access token. Please contact us for a new link.');
      }
    } catch (error) {
      alert('Login failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('customerPortalToken');
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken || savedToken) {
      handleLogin();
    }
  }, []);

  const uniqueEquipment = [...new Set(serviceReports.map(r => 
    `${r.equipment_type} ${r.equipment_make}`.trim()
  ))].filter(Boolean);

  const filteredReports = serviceReports.filter(report => {
    if (filterEquipment === 'all') return true;
    return `${report.equipment_type} ${report.equipment_make}`.trim() === filterEquipment;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Customer Portal</CardTitle>
            <p className="text-sm text-slate-500">Access your service records and requests</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAuthenticating ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
                <p className="text-sm text-slate-500">Verifying access...</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 text-center">
                  Please use the secure access link sent to you by your technician.
                </p>
                <p className="text-xs text-slate-500 text-center">
                  Don't have a link? Contact us to request portal access.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showNewAuthForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="outline" 
            onClick={() => setShowNewAuthForm(false)}
            className="mb-4"
          >
            ← Back to Portal
          </Button>
          <CustomerAuthorizationForm 
            customerId={customerId}
            onComplete={() => {
              setShowNewAuthForm(false);
              refetchAuthorizations();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Welcome back!</h1>
                <p className="text-sm text-slate-500">{customer?.company_name || customerEmail}</p>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                setIsAuthenticated(false);
                localStorage.removeItem('customerPortalToken');
                window.location.href = window.location.pathname;
              }}
            >
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="new-request">New Request</TabsTrigger>
            <TabsTrigger value="history">Service History</TabsTrigger>
            <TabsTrigger value="chat" className="relative">
              Chat
              {unreadMessages > 0 && (
                <Badge className="ml-2 bg-red-500 text-white px-1.5 py-0 h-5 text-xs">
                  {unreadMessages}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm text-slate-500">Pending Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-amber-500">
                    {authorizations.filter(a => a.status === 'draft' || a.status === 'authorized').length}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm text-slate-500">Total Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">
                    {serviceReports.length}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm text-slate-500">Unread Messages</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-500">
                    {unreadMessages}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {authorizations.slice(0, 5).map(auth => (
                  <div key={auth.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium text-sm">{auth.nature_of_service?.substring(0, 60)}...</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(auth.created_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={auth.status === 'completed' ? 'default' : 'secondary'}>
                      {auth.status}
                    </Badge>
                  </div>
                ))}
                {authorizations.length === 0 && (
                  <p className="text-center text-slate-400 py-8">No service requests yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new-request">
            <Button 
              className="w-full h-32 bg-amber-500 hover:bg-amber-600 text-lg"
              onClick={() => setShowNewAuthForm(true)}
            >
              <Plus className="w-6 h-6 mr-2" />
              Request New Service
            </Button>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <Select value={filterEquipment} onValueChange={setFilterEquipment}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Equipment</SelectItem>
                    {uniqueEquipment.map(eq => (
                      <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-service_date">Newest First</SelectItem>
                  <SelectItem value="service_date">Oldest First</SelectItem>
                  <SelectItem value="equipment_type">Equipment Type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredReports.map(report => (
              <Card key={report.id} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        {report.equipment_type} - {report.equipment_make} {report.equipment_model}
                      </h3>
                      <p className="text-sm text-slate-500">{report.complaint}</p>
                    </div>
                    <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </div>
                  <div className="flex gap-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(report.service_date), 'MMM d, yyyy')}
                    </div>
                    {report.service_items?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        ${report.service_items.reduce((sum, item) => sum + (item.total || 0), 0).toFixed(2)}
                      </div>
                    )}
                  </div>
                  {report.work_performed && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">{report.work_performed}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredReports.length === 0 && serviceReports.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <p className="text-slate-400">No reports match the selected filters</p>
                </CardContent>
              </Card>
            )}
            {serviceReports.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <p className="text-slate-400">No service history yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="chat">
            <ChatWindow 
              customerId={customerId}
              customerName={customer?.contact_name || customer?.company_name || 'Customer'}
              senderType="customer"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}