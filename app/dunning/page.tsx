import Link from "next/link";
import DecisionForm from "@/components/DecisionForm";
import GradeBadge from "@/components/GradeBadge";
import Notice from "@/components/Notice";
import PageHeader from "@/components/PageHeader";
import { db } from "@/lib/db";
import { kst, usd } from "@/lib/format";
import type { Check } from "@/lib/guardrails";

export const dynamic = "force-dynamic";

// 독촉 승인 대기열 — AI(claude -p)가 미리 쓴 초안을 사람이 승인 · 반려한다. 승인해도 메일은 나가지 않는다.
const TABS = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
  { key: "blocked", label: "막힘" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const isTab = (v: unknown): v is TabKey => typeof v === "string" && TABS.some((t) => t.key === v);

export default async function DunningPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const sp = await searchParams;
  const tab: TabKey = isTab(sp.tab) ? sp.tab : "pending";

  const [groups, drafts] = await Promise.all([
    db().dunningDraft.groupBy({ by: ["status"], _count: { _all: true } }),
    db().dunningDraft.findMany({
      where: { status: tab },
      orderBy: [{ overdueUsd: "desc" }, { buyerId: "asc" }],
      include: { buyer: { select: { name: true, grade: true } } },
    }),
  ]);
  const count = (key: TabKey) => groups.find((g) => g.status === key)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="독촉 승인" line="AI는 초안까지만 — 승인해도 메일은 나가지 않습니다(실제 발송 없음)" />

      <nav aria-label="초안 상태" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/dunning?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-1 rounded-md border px-4 text-sm font-semibold ${
                active ? "border-accent bg-accent text-white" : "border-line bg-bg text-ink hover:bg-surface"
              }`}
            >
              {t.label} <span className="num">{count(t.key)}</span>
            </Link>
          );
        })}
      </nav>

      {drafts.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-muted">이 탭에는 초안이 없습니다</p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d) => {
            const checks = (Array.isArray(d.checks) ? d.checks : []) as unknown as Check[];
            const passed = checks.filter((c) => c.ok).length;
            return (
              <li key={d.id} className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/buyers/${d.buyerId}`} className="num font-semibold text-accent underline-offset-2 hover:underline">
                    {d.buyerId}
                  </Link>
                  <span className="font-semibold text-ink">{d.buyer.name}</span>
                  <GradeBadge grade={d.buyer.grade} />
                </div>
                <p className="text-sm text-ink">
                  <span className="num">{d.stage}</span> · <span className="num">{d.tone}</span> · 연체{" "}
                  <span className="num">{usd(d.overdueUsd)}</span> · 초안 <span className="num">#{d.id}</span> · 만든 시각{" "}
                  <span className="num">{kst(d.createdAt)}</span>
                </p>
                <p className="text-ink">{d.summaryKo}</p>

                <div className="rounded-md border border-line bg-bg p-3">
                  <p className="font-semibold text-ink">{d.subject}</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink" lang="en">
                    {d.body}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-ink">
                    검사 <span className="num">{passed}/{checks.length}</span>
                  </p>
                  <ul className="mt-1 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {checks.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="num text-muted">{c.id}</span>
                        <span className="text-ink">{c.label}</span>
                        <span className={`font-semibold ${c.ok ? "text-grade-s" : "text-warn"}`}>{c.ok ? "통과" : "걸림"}</span>
                        {!c.ok && c.note ? <span className="text-warn">{c.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>

                {d.status === "pending" ? <DecisionForm draftId={d.id} /> : null}
                {d.status === "approved" ? (
                  <Notice tone="ok" title="발송 대기 — 실제 발송 없음">
                    {d.decidedBy} · <span className="num">{d.decidedAt ? kst(d.decidedAt) : "확인 필요"}</span>
                  </Notice>
                ) : null}
                {d.status === "rejected" ? (
                  <Notice tone="warn" title={`반려 — 사유: ${d.reason ?? "확인 필요"}`}>
                    {d.decidedBy} · <span className="num">{d.decidedAt ? kst(d.decidedAt) : "확인 필요"}</span>
                  </Notice>
                ) : null}
                {d.status === "blocked" ? (
                  <Notice tone="warn" title="막힘 — 검사에 걸려 승인할 수 없습니다">
                    걸린 검사: {checks.filter((c) => !c.ok).map((c) => `${c.id} ${c.label}`).join(" · ") || "확인 필요"}
                  </Notice>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
