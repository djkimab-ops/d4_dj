"use server";

import { revalidatePath } from "next/cache";
import type { ReviewState } from "@/components/ReviewForm";
import { db } from "@/lib/db";
import { REVIEW_STATUSES } from "@/lib/reviews";

// 확인 기록 쓰기 — 검사는 서버가 한다(브라우저 검사는 건너뛸 수 있다). 처음 걸린 하나만 돌려준다.
function check(status: string, memo: string, reviewer: string): string | null {
  if (!(REVIEW_STATUSES as readonly string[]).includes(status)) return "상태를 골라 주세요";
  if (memo.length === 0) return "메모를 적어 주세요";
  if (memo.length > 200) return "메모는 200자 이내로 적어 주세요";
  if (reviewer.length === 0) return "확인한 사람(별명)을 적어 주세요";
  if (reviewer.length > 20) return "별명은 20자 이내로 적어 주세요";
  return null;
}

export async function addReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const buyerId = field("buyerId");
  const status = field("status");
  const memo = field("memo");
  const reviewer = field("reviewer");

  const problem = check(status, memo, reviewer);
  if (problem) return { ok: false, message: problem };

  try {
    const buyer = await db().buyer.findUnique({ where: { id: buyerId }, select: { id: true } });
    if (!buyer) return { ok: false, message: "바이어를 찾을 수 없습니다" };

    await db().review.create({ data: { buyerId, status, memo, reviewer } });
  } catch {
    return { ok: false, message: "저장하지 못했습니다 — 잠시 뒤 다시 눌러 주세요" };
  }

  revalidatePath(`/buyers/${buyerId}`);
  revalidatePath("/");
  return { ok: true, message: "저장했습니다 — 새로 고쳐도 남아 있습니다" };
}
