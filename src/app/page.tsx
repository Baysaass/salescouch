import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Workspace } from '@/components/workspace';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <Workspace
      user={{ name: session.user.name ?? '', email: session.user.email ?? '', image: session.user.image ?? null }}
      aiEnabled={Boolean(process.env.OPENAI_API_KEY)}
      dbMode={process.env.DATABASE_URL ? 'supabase' : 'local'}
    />
  );
}
