import type { ContactChannels, ContactPersona } from '@/db/schema';

export const STAGE_LABELS: Record<string, string> = {
  lead: 'Шинэ lead',
  qualified: 'Шалгуур хангасан',
  proposal: 'Үнийн санал',
  negotiation: 'Хэлэлцээр',
  won: 'Гэрээ хийсэн',
  lost: 'Алдсан',
};

export const TEMPERATURE_LABELS: Record<string, string> = {
  hot: 'Халуун',
  warm: 'Дулаан',
  cold: 'Хүйтэн',
};

export const CHANNEL_FIELDS: { key: keyof ContactChannels; label: string; placeholder: string }[] = [
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/...' },
  { key: 'instagram', label: 'Instagram', placeholder: '@username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/...' },
  { key: 'telegram', label: 'Telegram', placeholder: '@username' },
  { key: 'whatsapp', label: 'WhatsApp / Viber', placeholder: '+976 ...' },
  { key: 'website', label: 'Вэбсайт', placeholder: 'https://...' },
  { key: 'other', label: 'Бусад', placeholder: '...' },
];

export const PERSONA_FIELDS: { key: keyof ContactPersona; label: string; placeholder: string }[] = [
  { key: 'summary', label: 'Товч тодорхойлолт', placeholder: 'Энэ хүн хэн бэ, юуг чухалчилдаг вэ?' },
  { key: 'segment', label: 'Сегмент', placeholder: 'Хувь хүн / ЖДҮ / Корпорац' },
  { key: 'decisionRole', label: 'Шийдвэрт оролцох үүрэг', placeholder: 'Шийдвэр гаргагч, нөлөөлөгч...' },
  { key: 'goals', label: 'Зорилго', placeholder: 'Юунд хүрэхийг хүсдэг вэ?' },
  { key: 'pains', label: 'Өвдөлт / асуудал', placeholder: 'Юу санаа зовоож байна?' },
  { key: 'budget', label: 'Төсөв', placeholder: 'Жилийн хураамжийн төсөв' },
  { key: 'timeline', label: 'Хугацаа', placeholder: 'Хэзээ шийдвэр гаргах вэ?' },
  { key: 'currentInsurer', label: 'Одоогийн даатгагч', placeholder: 'Аль компанид даатгуулдаг вэ?' },
  { key: 'productsOfInterest', label: 'Сонирхож буй бүтээгдэхүүн', placeholder: 'Эрүүл мэнд, хөрөнгө, авто...' },
  { key: 'renewalDate', label: 'Гэрээ сунгах огноо', placeholder: '2027-03-01' },
  { key: 'objections', label: 'Гарч болох татгалзал', placeholder: 'Үнэтэй, хэрэггүй...' },
  { key: 'communicationStyle', label: 'Харилцааны хэв маяг', placeholder: 'Тоо баримт, богино, албан...' },
];
