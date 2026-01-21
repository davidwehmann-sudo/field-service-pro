import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CompanySelector({ currentUser, onCompanyChange }) {
  const [selectedCompany, setSelectedCompany] = useState(currentUser?.current_company || currentUser?.company);

  if (!currentUser || !['bookkeeper', 'software_engineer'].includes(currentUser.user_type) || !currentUser.companies_managed?.length) {
    return null;
  }

  const handleCompanyChange = async (company) => {
    setSelectedCompany(company);
    await base44.auth.updateMe({ current_company: company });
    onCompanyChange(company);
  };

  return (
    <div className="px-4 py-3 border-t border-slate-700">
      <label className="text-xs text-slate-500 block mb-2">Service Company</label>
      <Select value={selectedCompany} onValueChange={handleCompanyChange}>
        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {currentUser.companies_managed.map((company) => (
            <SelectItem key={company} value={company}>
              {company}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}