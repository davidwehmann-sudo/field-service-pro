import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { format } from 'date-fns';

export default function ChatWindow({ customerId, customerName, senderType = "customer" }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const loadMessages = async () => {
      const msgs = await base44.entities.ChatMessage.filter(
        { customer_id: customerId },
        '-created_date',
        100
      );
      setMessages(msgs.reverse());
    };
    loadMessages();

    // Real-time subscription
    const unsubscribe = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data.customer_id === customerId) {
        if (event.type === 'create') {
          setMessages(prev => [...prev, event.data]);
          
          // Mark as read
          if (senderType === 'customer' && event.data.sender_type === 'technician') {
            base44.entities.ChatMessage.update(event.id, { read_by_customer: true });
          } else if (senderType === 'technician' && event.data.sender_type === 'customer') {
            base44.entities.ChatMessage.update(event.id, { read_by_technician: true });
          }
        }
      }
    });

    return unsubscribe;
  }, [customerId, senderType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      await base44.entities.ChatMessage.create({
        customer_id: customerId,
        sender_type: senderType,
        sender_name: customerName,
        message: newMessage,
        read_by_customer: senderType === 'customer',
        read_by_technician: senderType === 'technician',
      });
      setNewMessage('');
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleAIEnhance = async () => {
    if (!newMessage.trim()) {
      toast.error("Write a message first");
      return;
    }

    setIsEnhancing(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Improve this message to be more professional and clear, while keeping the same meaning and tone. Keep it concise.

Original message: ${newMessage}

Return only the improved message, nothing else.`,
      });

      setNewMessage(response);
      toast.success("Message enhanced");
    } catch (error) {
      toast.error("Failed to enhance message");
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm flex flex-col h-[600px]">
      <CardHeader className="border-b">
        <CardTitle className="text-lg">
          {senderType === 'customer' ? 'Chat with Technicians' : 'Customer Chat'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-slate-400 text-sm mt-8">
              No messages yet. Start the conversation!
            </p>
          )}
          {messages.map((msg) => {
            const isOwn = msg.sender_type === senderType;
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl px-4 py-2 ${
                    isOwn 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-slate-100 text-slate-900'
                  }`}>
                    <p className="text-xs font-medium mb-1 opacity-75">
                      {msg.sender_name}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 px-2">
                    {format(new Date(msg.created_date), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4 space-y-2">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAIEnhance}
              disabled={isEnhancing || !newMessage.trim()}
            >
              {isEnhancing ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enhancing...</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1" /> AI Enhance</>
              )}
            </Button>
            <Button 
              className="ml-auto bg-amber-500 hover:bg-amber-600"
              onClick={handleSend}
              disabled={isSending || !newMessage.trim()}
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}