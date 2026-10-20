import { db } from "@/lib/db";

// 확인 기록 읽기 — 서버 전용(서버 컴포넌트 · 서버 액션에서만 부른다).
export const REVIEW_STATUSES = ["확인 필요", "확인 완료", "보류"] as const;

/** 상태 배지의 테두리 · 글자 색(배지에는 언제나 상태 글자를 함께 쓴다). */
export function statusBadgeClass(status: string): string {
  if (status === "확인 필요") return "border-warn text-warn";
  if (status === "확인 완료") return "border-accent text-accent";
  return "border-line text-muted";
}

const NEWEST_FIRST = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/** 그 바이어의 기록 — 최신이 위. */
export async function getReviews(buyerId: string, take = 20) {
  return db().review.findMany({ where: { buyerId }, orderBy: NEWEST_FIRST, take });
}

/** 모든 바이어의 최신 기록 — 바이어 이름 포함. */
export async function getRecentReviews(take = 5) {
  return db().review.findMany({
    orderBy: NEWEST_FIRST,
    take,
    include: { buyer: { select: { name: true } } },
  });
}
