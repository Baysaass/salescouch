import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';
import { verifyProCouponCode } from '@/lib/coupons';
import { couponRedeemInput } from '@/lib/validators';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const parsed = couponRedeemInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Coupon код оруулна уу' }, { status: 400 });
  }

  if (user.plan === 'pro') {
    return NextResponse.json({
      ok: true,
      plan: 'pro',
      alreadyPro: true,
      message: 'Таны эрх аль хэдийн Pro байна.',
    });
  }

  const matchedCode = verifyProCouponCode(parsed.data.code);
  if (!matchedCode) {
    return NextResponse.json({ error: 'Coupon код буруу эсвэл хүчингүй байна' }, { status: 400 });
  }

  const db = await getDb();
  await db
    .insert(schema.users)
    .values({
      id: user.id,
      email: user.email || user.id,
      name: user.name,
      image: user.image,
      plan: 'pro',
      followedTags: user.followedTags,
      redeemedCoupon: matchedCode,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: {
        plan: 'pro',
        redeemedCoupon: matchedCode,
        name: user.name,
        image: user.image,
      },
    });

  return NextResponse.json({
    ok: true,
    plan: 'pro',
    message: 'Баяр хүргэе! Таны эрх амжилттай Pro боллоо.',
  });
}
