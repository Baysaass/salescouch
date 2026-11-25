import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/api';
import { Workspace } from '@/components/workspace';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <Workspace
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        plan: user.plan,
        followedTags: user.followedTags,
      }}
      aiEnabled={Boolean(process.env.OPENAI_API_KEY)}
    />
  );
}
