import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

export default function CustomerSelect({ customers, value, onChange, placeholder = "Select customer" }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {customers.map((customer) => (
          <SelectItem key={customer.id} value={customer.id}>
            <div>
              <p className="font-medium">{customer.company_name}</p>
              {customer.contact_name && (
                <p className="text-xs text-slate-500">{customer.contact_name}</p>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}