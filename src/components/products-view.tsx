'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, FileText, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { CATEGORY_NAMES, COMPANY_FACTS, PRODUCTS, type ProductCategory } from '@/lib/products';
import type { ContactDTO } from './types';
import { ApplyBar } from './apply-bar';
import { clsx } from './clsx';

interface Props {
  query: string;
  contacts: ContactDTO[];
  selectedContactId: string | null;
  onApply: (contactId: string, productId: string) => void;
}

export function ProductsView({ query, contacts, selectedContactId, onApply }: Props) {
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => (q ? PRODUCTS.filter((p) => `${p.name} ${p.tagline} ${p.keywords.join(' ')} ${p.idealFor.join(' ')}`.toLowerCase().includes(q)) : PRODUCTS),
    [q],
  );
  const [activeId, setActiveId] = useState(PRODUCTS[0].id);
  const p = PRODUCTS.find((x) => x.id === activeId) ?? PRODUCTS[0];
  const cats = (Object.keys(CATEGORY_NAMES) as ProductCategory[]).filter((c) => list.some((x) => x.category === c));

  return (
    <div className="flex min-w-0 flex-1">
      <div className="scroll-thin w-[300px] shrink-0 overflow-y-auto border-r border-line px-3 pb-6 pt-5">
        <h2 className="px-2 text-[17px] font-semibold">Бүтээгдэхүүн</h2>
        <p className="px-2 pb-2 text-[12.5px] text-ink-3">Практикал Даатгал · {PRODUCTS.length} бүтээгдэхүүн</p>
        {cats.map((c) => (
          <div key={c} className="mt-3">
            <p className="px-2 pb-1 text-[12px] font-medium uppercase tracking-wide text-ink-3">{CATEGORY_NAMES[c]}</p>
            {list
              .filter((x) => x.category === c)
              .map((x) => (
                <button
                  key={x.id}
                  onClick={() => setActiveId(x.id)}
                  className={clsx('block w-full rounded-lg px-2.5 py-2 text-left', activeId === x.id ? 'bg-brand-soft' : 'hover:bg-[#f4f5f7]')}
                >
                  <span className={clsx('block truncate text-[14px]', activeId === x.id ? 'font-medium text-brand' : 'text-ink')}>
                    {x.name}
                    {x.status === 'check' && <span className="ml-1 text-amber-500">•</span>}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">{x.premium}</span>
                </button>
              ))}
          </div>
        ))}
        {!cats.length && <p className="px-2 py-4 text-sm text-ink-3">Тохирох бүтээгдэхүүн олдсонгүй.</p>}
      </div>

      <article className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-10 pb-16 pt-9">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="rounded-md bg-[#f2f3f5] px-2 py-0.5 text-ink-2">{CATEGORY_NAMES[p.category]}</span>
            <span className="rounded-md bg-[#f2f3f5] px-2 py-0.5 text-ink-2">{p.segment}</span>
            {p.status === 'check' ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">
                <AlertTriangle className="h-3 w-3" /> Хуучин/төслийн баримт — нөхцөлийг баталгаажуулна уу
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
                <BadgeCheck className="h-3 w-3" /> Гэрээний баримтаас
              </span>
            )}
          </div>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">{p.name}</h1>
          <p className="mt-1 text-[15.5px] text-ink-2">{p.tagline}</p>

          <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            <Fact label="Хураамж" value={p.premium} />
            <Fact label="Даатгалын үнэлгээ" value={p.sumInsured} />
            <Fact label="Хариуцах хэсэг" value={p.deductible ?? '—'} />
          </div>

          <H icon={Users} title="Хэнд тохирох вэ" />
          <Bullets items={p.idealFor} />

          <H icon={ShieldCheck} title="Хамгаалалт" />
          <Bullets items={p.coverage} />

          {p.claims && (
            <>
              <H icon={FileText} title="Нөхөн төлбөр" />
              <p className="text-[15px] leading-relaxed">{p.claims}</p>
            </>
          )}

          {p.exclusions && p.exclusions.length > 0 && (
            <>
              <H icon={AlertTriangle} title="Гол татгалзах нөхцөл (харилцагчид шударгаар хэлэх)" />
              <Bullets items={p.exclusions} dot="bg-rose-400" />
            </>
          )}

          <H icon={Sparkles} title="Борлуулахдаа онцлох" />
          <Bullets items={p.sellingPoints} dot="bg-emerald-500" />

          <div className="mt-10 rounded-2xl border border-line p-5">
            <p className="text-[14px] font-medium">Харилцагчид санал болгох</p>
            <p className="mb-3 mt-0.5 text-[13px] text-ink-3">Коуч энэ бүтээгдэхүүнийг тухайн харилцагчийн нөхцөлд тааруулж танилцуулах скрипт, тооцоо, имэйл гаргана.</p>
            <ApplyBar contacts={contacts} defaultContactId={selectedContactId} label="Санал бэлтгэх" onApply={(cid) => onApply(cid, p.id)} />
          </div>

          <p className="mt-6 text-xs text-ink-3">Эх сурвалж: {p.source}</p>

          <details className="mt-8 rounded-xl border border-line p-4 text-[13.5px] text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">Компанийн ерөнхий мэдээлэл</summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{COMPANY_FACTS}</p>
          </details>
        </div>
      </article>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="mt-1 text-[14px] font-medium leading-snug">{value}</p>
    </div>
  );
}

function H({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <h2 className="mb-3 mt-8 flex items-center gap-2 text-[16px] font-semibold">
      <Icon className="h-[18px] w-[18px] text-ink-2" /> {title}
    </h2>
  );
}

function Bullets({ items, dot = 'bg-brand' }: { items: string[]; dot?: string }) {
  return (
    <ul className="space-y-2">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
          <span className={clsx('mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
          {x}
        </li>
      ))}
    </ul>
  );
}
