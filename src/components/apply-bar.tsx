'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import type { ContactDTO } from './types';

/** Docs / Бүтээгдэхүүн хуудаснаас сонгосон харилцагч дээр коучийг ажиллуулах мөр */
export function ApplyBar({
  contacts,
  defaultContactId,
  label,
  buttonText,
  onApply,
}: {
  contacts: ContactDTO[];
  defaultContactId: string | null;
  label: string;
  buttonText?: string;
  onApply: (contactId: string) => void;
}) {
  const [cid, setCid] = useState(defaultContactId ?? contacts[0]?.id ?? '');
  if (!contacts.length) {
    return <p className="text-sm text-ink-3">Энэ аргыг хэрэглэхийн тулд эхлээд “Харилцагчид” хэсэгт харилцагч нэмнэ үү.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={cid} onChange={(e) => setCid(e.target.value)} className="h-10 min-w-[220px] rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand">
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
            {c.company ? ` — ${c.company}` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={() => cid && onApply(cid)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600"
      >
        <Play className="h-4 w-4" /> {buttonText ?? label}
      </button>
    </div>
  );
}
