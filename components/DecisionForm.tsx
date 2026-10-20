"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { decide } from "@/app/dunning/actions";
import Notice from "@/components/Notice";

// 승인 · 반려 폼: 보내기만 하고 검사 · 승인 코드 비교 · 저장은 서버 액션(decide)이 한다.
// maxLength · required를 두지 않는다 — 서버 검사가 진짜 문지기다.
export type DecisionState = { ok: boolean; message: string };

export default function DecisionForm({ draftId }: { draftId: number }) {
  const [state, formAction, pending] = useActionState(decide, { ok: false, message: "" });

  // <form action>으로 보내면 React가 폼을 처음 값으로 되돌린다 — 별명 · 사유를 지키려고 직접 보낸다.
  // 누른 단추(승인 · 반려)의 decision 값이 들어가게 submitter를 함께 넘긴다.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(data));
  }

  const id = (name: string) => `draft-${draftId}-${name}`;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-bg p-3">
      <input type="hidden" name="draftId" value={draftId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id("approver")} className="text-sm font-semibold text-ink">
            승인자 별명
          </label>
          <input
            id={id("approver")}
            name="approver"
            type="text"
            placeholder="실명 대신 별명"
            className="mt-1 block min-h-11 w-full rounded-md border border-line bg-bg px-3 text-ink"
          />
        </div>
        <div>
          <label htmlFor={id("pin")} className="text-sm font-semibold text-ink">
            승인 코드
          </label>
          <input
            id={id("pin")}
            name="pin"
            type="password"
            autoComplete="off"
            className="mt-1 block min-h-11 w-full rounded-md border border-line bg-bg px-3 text-ink"
          />
        </div>
      </div>

      <div>
        <label htmlFor={id("reason")} className="text-sm font-semibold text-ink">
          반려 사유(반려할 때 5–200자)
        </label>
        <textarea
          id={id("reason")}
          name="reason"
          rows={2}
          placeholder="예: 지난주 입금 약속을 받았음 — 다음 주에 다시 보기"
          className="mt-1 block w-full rounded-md border border-line bg-bg p-3 text-ink"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          승인
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md border border-warn bg-bg px-4 text-sm font-semibold text-warn disabled:opacity-60"
        >
          반려
        </button>
        {pending ? <span className="flex min-h-11 items-center text-sm text-muted">처리 중…</span> : null}
      </div>

      {state.message ? <Notice tone={state.ok ? "ok" : "warn"} title={state.message} /> : null}
    </form>
  );
}
