import { kst } from "@/lib/format";
import { getRecentReviews } from "@/lib/reviews";

// 감시 모드용 route handler — 가장 최근 확인 기록 1건의 번호 · 바이어 · 상태 · 시각만 돌려준다.
// 메모 · 별명은 내보내지 않는다. 부를 때마다 DB를 새로 읽는다(캐시 없음).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [r] = await getRecentReviews(1);
    if (!r) return Response.json({ ok: true, latest: null });
    return Response.json({
      ok: true,
      latest: { id: r.id, buyerId: r.buyerId, buyerName: r.buyer.name, status: r.status, at: kst(r.createdAt) },
    });
  } catch {
    return Response.json({ ok: false, latest: null }, { status: 500 });
  }
}
