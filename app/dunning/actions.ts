"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { DecisionState } from "@/components/DecisionForm";
import { db } from "@/lib/db";

// 독촉 초안 승인 · 반려 — 검사 · 승인 코드 비교는 서버가 한다. 승인해도 메일은 나가지 않는다(실제 발송 없음).
// 승인 코드 값은 화면 · 로그 · 응답에 쓰지 않는다.

/** 길이와 상관없이 같은 시간에 견준다(해시 후 비교). */
function samePin(input: string, pin: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(pin).digest();
  return timingSafeEqual(a, b);
}

function check(id: number, decision: string, approver: string, reason: string): string | null {
  if (!Number.isInteger(id) || id < 1) return "초안 번호가 올바르지 않습니다";
  if (decision !== "approve" && decision !== "reject") return "승인 또는 반려를 골라 주세요";
  if (approver.length === 0) return "승인자 별명을 적어 주세요";
  if (approver.length > 20) return "별명은 20자 이내로 적어 주세요";
  if (decision === "reject" && reason.length < 5) return "반려 사유를 5자 이상 적어 주세요";
  if (decision === "reject" && reason.length > 200) return "반려 사유는 200자 이내로 적어 주세요";
  return null;
}

export async function decide(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  // 1. 승인 코드가 설정되어 있어야 한다.
  const pin = process.env.APPROVER_PIN ?? "";
  if (pin.trim().length === 0) return { ok: false, message: "승인 코드가 설정되지 않았습니다" };

  // 2. 입력 검사.
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const id = Number(field("draftId"));
  const decision = field("decision");
  const approver = field("approver");
  const reason = field("reason");
  const problem = check(id, decision, approver, reason);
  if (problem) return { ok: false, message: problem };

  // 3. 승인 코드 비교 — 다르면 DB는 아무것도 바꾸지 않는다(감사 기록도 없음).
  if (!samePin(field("pin"), pin.trim())) return { ok: false, message: "승인 코드가 다릅니다" };

  // 4. pending인 초안만 바꾸고, 바뀐 경우에만 감사 기록 한 줄.
  const approve = decision === "approve";
  let changed = false;
  try {
    changed = await db().$transaction(async (tx) => {
      const res = await tx.dunningDraft.updateMany({
        where: { id, status: "pending" },
        data: { status: approve ? "approved" : "rejected", decidedBy: approver, decidedAt: new Date(), reason: approve ? null : reason },
      });
      if (res.count === 0) return false;
      const draft = await tx.dunningDraft.findUniqueOrThrow({ where: { id }, select: { buyerId: true } });
      await tx.auditLog.create({
        data: {
          actor: approver,
          action: approve ? "승인" : "반려",
          target: `${draft.buyerId} · 초안 #${id}`,
          detail: approve ? "발송 대기 — 실제 발송 없음" : `사유: ${reason}`,
        },
      });
      return true;
    });
  } catch {
    return { ok: false, message: "저장하지 못했습니다 — 잠시 뒤 다시 눌러 주세요" };
  }

  // 5. 화면 다시 그리기.
  revalidatePath("/dunning");
  revalidatePath("/audit");
  if (!changed) return { ok: false, message: "이미 처리된 초안입니다" };
  return { ok: true, message: approve ? "승인했습니다 — 발송 대기(실제 발송 없음)" : "반려했습니다" };
}
