import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function CompanySelector({ currentUser, onCompanyChange }) {
  const [selectedCompany, setSelectedCompany] = useState(currentUser?.current_company || currentUser?.company);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!currentUser || !['bookkeeper', 'software_engineer'].includes(currentUser.user_type) || !currentUser.companies_managed?.length) {
    return null;
  }

  const handleCompanyChange = async (company) => {
    setSelectedCompany(company);
    setIsUpdating(true);
    try {
      await base44.auth.updateMe({ current_company: company });
      onCompanyChange(company);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t border-slate-700">
      <label className="text-xs text-slate-500 block mb-2">Service Company</label>
      {isUpdating ? (
        <Skeleton className="h-9 w-full bg-slate-800" />
      ) : (
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
      )}
    </div>
  );
}