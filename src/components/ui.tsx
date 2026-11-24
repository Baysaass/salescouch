'use client';
import { clsx } from './clsx';

const PALETTE = ['#4f8a9c', '#d9a43b', '#c76bb0', '#6b7fd7', '#5aa06b', '#d9734f', '#8a6bd7'];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, image, size = 40, className }: { name: string; image?: string | null; size?: number; className?: string }) {
  const color = PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" width={size} height={size} className={clsx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={clsx('flex shrink-0 items-center justify-center rounded-full font-medium text-white', className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export function relTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function IconButton({ title, onClick, children, href, className }: { title: string; onClick?: () => void; children: React.ReactNode; href?: string; className?: string }) {
  const cls = clsx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink', className);
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" title={title} aria-label={title} className={cls}>{children}</a>;
  return <button type="button" title={title} aria-label={title} onClick={onClick} className={cls}>{children}</button>;
}

export function gmailComposeUrl(to?: string | null, subject?: string, body?: string) {
  const q = new URLSearchParams({ view: 'cm', fs: '1' });
  if (to) q.set('to', to);
  if (subject) q.set('su', subject);
  if (body) q.set('body', body);
  return `https://mail.google.com/mail/?${q.toString()}`;
}
