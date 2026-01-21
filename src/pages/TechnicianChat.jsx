import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, MessageSquare } from "lucide-react";
import ChatWindow from '@/components/customer/ChatWindow';
import { Badge } from '@/components/ui/badge';

export default function TechnicianChat() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-updated_date'),
  });

  const { data: allMessages = [] } = useQuery({
    queryKey: ['all-chat-messages'],
    queryFn: () => base44.entities.ChatMessage.list('-created_date', 1000),
    refetchInterval: 5000,
  });

  // Get unread count per customer
  const getUnreadCount = (customerId) => {
    return allMessages.filter(
      msg => msg.customer_id === customerId && 
             msg.sender_type === 'customer' && 
             !msg.read_by_technician
    ).length;
  };

  const filteredCustomers = customers.filter(c =>
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)]">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Customer Communications</h1>
      
      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100%-4rem)]">
        {/* Customer List */}
        <Card className="border-0 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredCustomers.map(customer => {
              const unreadCount = getUnreadCount(customer.id);
              const isActive = selectedCustomer?.id === customer.id;
              
              return (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className={`w-full p-4 text-left hover:bg-slate-50 transition-colors border-b ${
                    isActive ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{customer.company_name}</p>
                      <p className="text-xs text-slate-500 truncate">{customer.contact_name}</p>
                    </div>
                    {unreadCount > 0 && (
                      <Badge className="ml-2 bg-red-500 text-white px-2 py-0 h-5 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredCustomers.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <p className="text-sm">No customers found</p>
              </div>
            )}
          </div>
        </Card>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <ChatWindow
              customerId={selectedCustomer.id}
              customerName="Technician"
              senderType="technician"
            />
          ) : (
            <Card className="border-0 shadow-sm h-full flex items-center justify-center">
              <div className="text-center text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a customer to start chatting</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}