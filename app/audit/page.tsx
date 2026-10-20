import Link from "next/link";
import DataTable from "@/components/DataTable";
import PageHeader from "@/components/PageHeader";
import { db } from "@/lib/db";
import { int, kst } from "@/lib/format";

export const dynamic = "force-dynamic";

// 감사 기록 — 쌓기만 한다. 이 쪽은 읽기만 하고, 지우거나 고치는 단추 · 코드는 어디에도 없다.
const FILTERS = ["전체", "초안 작성", "초안 막힘", "승인", "반려"] as const;
const TAKE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string | string[] }> }) {
  const sp = await searchParams;
  const action = typeof sp.action === "string" && (FILTERS as readonly string[]).includes(sp.action) && sp.action !== "전체" ? sp.action : null;
  const where = action ? { action } : {};

  const [total, logs] = await Promise.all([
    db().auditLog.count({ where }),
    db().auditLog.findMany({ where, orderBy: [{ at: "desc" }, { id: "desc" }], take: TAKE }),
  ]);

  const rows = logs.map((l) => ({
    at: <span className="num">{kst(l.at, true)}</span>,
    actor: l.actor,
    action: l.action,
    target: <span className="num">{l.target}</span>,
    detail: l.detail,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="감사 기록" line="이 기록은 지우거나 고치지 않습니다" />

      <nav aria-label="기록 거르기" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (action ?? "전체") === f;
          const href = f === "전체" ? "/audit" : `/audit?action=${encodeURIComponent(f)}`;
          return (
            <Link
              key={f}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold ${
                active ? "border-accent bg-accent text-white" : "border-line bg-bg text-ink hover:bg-surface"
              }`}
            >
              {f}
            </Link>
          );
        })}
      </nav>

      <p className="text-sm text-muted">
        모두 <span className="num">{int(total)}줄</span> · 최근 <span className="num">{TAKE}줄</span>까지
      </p>

      <DataTable
        caption="감사 기록 — 최신이 위"
        columns={[
          { key: "at", label: "시각" },
          { key: "actor", label: "누가" },
          { key: "action", label: "무엇을" },
          { key: "target", label: "대상" },
          { key: "detail", label: "내용" },
        ]}
        rows={rows}
        empty="아직 감사 기록이 없습니다"
      />
    </div>
  );
}
