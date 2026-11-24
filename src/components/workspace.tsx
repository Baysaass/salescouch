'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar, type View } from './sidebar';
import { ContactList } from './contact-list';
import { ChatPanel } from './chat-panel';
import { ContactPanel } from './contact-panel';
import { ContactFormModal } from './contact-form';
import { DocsView } from './docs-view';
import { ProductsView } from './products-view';
import { PlaybookView } from './playbook-view';
import type { ContactDTO, MessageDTO } from './types';
import { SKILLS, SKILL_MAP } from '@/lib/skills';
import { PRODUCTS, PRODUCT_MAP } from '@/lib/products';

interface Props {
  user: { name: string; email: string; image: string | null };
  aiEnabled: boolean;
  dbMode: 'supabase' | 'local';
}

export function Workspace({ user, aiEnabled, dbMode }: Props) {
  const [contacts, setContacts] = useState<ContactDTO[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('chat');
  const [pending, setPending] = useState<{ contactId: string; content: string; skill: string | null } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const selected = useMemo(() => contacts.find((c) => c.id === selectedId) ?? null, [contacts, selectedId]);

  // Харилцагчдыг ачаалах
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Харилцагч ачаалж чадсангүй'))))
      .then((rows: ContactDTO[]) => {
        setContacts(rows);
        if (rows[0]) setSelectedId((cur) => cur ?? rows[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingContacts(false));
  }, []);

  // Сонгосон харилцагчийн чат
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessages([]);
    setLoadedFor(null);
    fetch(`/api/contacts/${selectedId}/messages`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: MessageDTO[]) => {
        if (cancelled) return;
        setMessages(rows);
        setLoadedFor(selectedId);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const upsertContact = useCallback((c: ContactDTO) => {
    setContacts((list) => {
      const prev = list.find((x) => x.id === c.id);
      const merged = { ...prev, ...c, lastMessage: c.lastMessage ?? prev?.lastMessage, lastAt: c.lastAt ?? prev?.lastAt };
      return [merged, ...list.filter((x) => x.id !== c.id)];
    });
  }, []);

  const abortCtrlRef = useRef<AbortController | null>(null);

  const cancelStreaming = useCallback(() => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    setStreaming(false);
    setMessages((m) => m.map((x) => (x.pending ? { ...x, pending: false } : x)));
  }, []);

  const send = useCallback(
    async (content: string, skill?: string | null) => {
      if (!selectedId || !content.trim()) return;
      if (streaming) {
        cancelStreaming();
      }
      const contactId = selectedId;
      const now = new Date().toISOString();
      const userMsg: MessageDTO = { id: `u-${now}`, role: 'user', content, skill: skill ?? null, createdAt: now };
      const botId = `a-${now}`;
      setMessages((m) => [...m, userMsg, { id: botId, role: 'assistant', content: '', skill: skill ?? null, createdAt: now, pending: true }]);
      setStreaming(true);

      const abortCtrl = new AbortController();
      abortCtrlRef.current = abortCtrl;
      const timeoutId = setTimeout(() => abortCtrl.abort(), 28000);

      try {
        const res = await fetch(`/api/contacts/${contactId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortCtrl.signal,
          body: JSON.stringify({ content, skill }),
        });
        clearTimeout(timeoutId);
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error || 'Хариу авч чадсангүй');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: full, pending: false } : x)));
        }
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, pending: false } : x)));
        setContacts((list) => {
          const c = list.find((x) => x.id === contactId);
          if (!c) return list;
          return [{ ...c, lastMessage: full, lastAt: new Date().toISOString() }, ...list.filter((x) => x.id !== contactId)];
        });
      } catch (e) {
        clearTimeout(timeoutId);
        const isAbort = (e as Error).name === 'AbortError';
        const msg = isAbort ? 'Хариу өгөх хугацаа хэтэрсэн тул зогслоо. Та дахин бичнэ үү.' : (e as Error).message;
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: `> ⚠️ ${msg}`, pending: false } : x)));
      } finally {
        clearTimeout(timeoutId);
        abortCtrlRef.current = null;
        setStreaming(false);
      }
    },
    [selectedId, streaming, cancelStreaming],
  );

  // Docs / Бүтээгдэхүүн хуудаснаас ирсэн хүсэлтийг чат ачаалагдсаны дараа илгээнэ
  useEffect(() => {
    if (pending && loadedFor === pending.contactId && selectedId === pending.contactId && !streaming) {
      const p = pending;
      setPending(null);
      send(p.content, p.skill);
    }
  }, [pending, loadedFor, selectedId, streaming, send]);

  const applyToContact = useCallback((contactId: string, content: string, skill: string | null) => {
    setView('chat');
    setQuery('');
    setSelectedId(contactId);
    setPending({ contactId, content, skill });
  }, []);

  const clearChat = useCallback(async () => {
    if (!selectedId || !confirm('Энэ харилцагчтай холбоотой чатын түүхийг устгах уу?')) return;
    await fetch(`/api/contacts/${selectedId}/messages`, { method: 'DELETE' });
    setMessages([]);
    setContacts((l) => l.map((c) => (c.id === selectedId ? { ...c, lastMessage: null } : c)));
  }, [selectedId]);

  const deleteContact = useCallback(async (id: string) => {
    if (!confirm('Харилцагч болон түүний чатыг бүр мөсөн устгах уу? Буцаах боломжгүй.')) return;
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setContacts((l) => {
      const next = l.filter((c) => c.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }, []);

  return (
    <div className="flex h-dvh gap-3 p-3">
      <Sidebar
        user={user}
        aiEnabled={aiEnabled}
        dbMode={dbMode}
        view={view}
        onView={(v) => {
          setView(v);
          setQuery('');
        }}
        query={query}
        onQuery={setQuery}
        counts={{ contacts: contacts.length, playbook: 3, docs: SKILLS.length, products: PRODUCTS.length }}
      />

      <div className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-panel">
        {view === 'playbook' && (
          <PlaybookView
            query={query}
            contacts={contacts}
            selectedContactId={selectedId}
            onApply={(cid, text) => applyToContact(cid, text, null)}
          />
        )}

        {view === 'docs' && (
          <DocsView
            query={query}
            contacts={contacts}
            selectedContactId={selectedId}
            onApply={(cid, skillId) => applyToContact(cid, SKILL_MAP[skillId].prompt, skillId)}
          />
        )}

        {view === 'products' && (
          <ProductsView
            query={query}
            contacts={contacts}
            selectedContactId={selectedId}
            onApply={(cid, productId) =>
              applyToContact(
                cid,
                `Энэ харилцагчид "${PRODUCT_MAP[productId].name}"-ийг санал болгомоор байна. Тохирох эсэхийг үнэлж, хураамжийн жишээ тооцоо, танилцуулах скрипт, гарч болох татгалзлын хариу, Gmail ноорог гаргаж өг.`,
                null,
              )
            }
          />
        )}

        {view === 'chat' && (
          <>
            <div className="w-[320px] shrink-0 border-r border-line">
              <ContactList
                contacts={contacts}
                loading={loadingContacts}
                query={query}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onNew={() => setFormOpen(true)}
              />
            </div>

            <ChatPanel
              contact={selected}
              messages={messages}
              streaming={streaming}
              aiEnabled={aiEnabled}
              onSend={send}
              onClear={clearChat}
              onNewContact={() => setFormOpen(true)}
              onCancel={cancelStreaming}
            />

            {selected && <ContactPanel key={selected.id} contact={selected} aiEnabled={aiEnabled} onSaved={upsertContact} onDelete={() => deleteContact(selected.id)} />}
          </>
        )}
      </div>

      {formOpen && (
        <ContactFormModal
          onClose={() => setFormOpen(false)}
          onCreated={(c) => {
            upsertContact(c);
            setSelectedId(c.id);
            setFormOpen(false);
          }}
        />
      )}

      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}
