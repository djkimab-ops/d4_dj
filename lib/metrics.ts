import type { Buyer, Grade } from "@/lib/buyers";

// 순수 계산만 — 화면 글자는 만들지 않는다. 등급은 grade 칸 그대로(pd30d로 다시 매기지 않는다).
export const GRADES: Grade[] = ["S", "A", "B", "C"];

const sum = (list: Buyer[], pick: (b: Buyer) => number) => list.reduce((s, b) => s + pick(b), 0);

export function kpis(buyers: Buyer[]) {
  const c = buyers.filter((b) => b.grade === "C");
  const arAll = sum(buyers, (b) => b.openArUsd);
  const arC = sum(c, (b) => b.openArUsd);
  return {
    cCount: c.length,
    cArUsd: arC,
    cShare: arAll > 0 ? arC / arAll : null,
    arUsd: arAll,
    count: buyers.length,
    overdueUsd: sum(buyers, (b) => b.overdueUsd),
    overdueCount: buyers.filter((b) => b.overdueUsd > 0).length,
  };
}

export function gradeCounts(buyers: Buyer[]): { grade: Grade; count: number }[] {
  return GRADES.map((grade) => ({ grade, count: buyers.filter((b) => b.grade === grade).length }));
}

function byRisk(a: Buyer, b: Buyer) {
  return b.pd30d - a.pd30d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function topRisk(buyers: Buyer[], n = 10): Buyer[] {
  return [...buyers].sort(byRisk).slice(0, n);
}

export function byRegion(buyers: Buyer[]) {
  const map = new Map<string, Buyer[]>();
  for (const b of buyers) map.set(b.region, [...(map.get(b.region) ?? []), b]);
  return [...map.entries()]
    .map(([region, list]) => {
      const arUsd = sum(list, (b) => b.openArUsd);
      const cArUsd = sum(
        list.filter((b) => b.grade === "C"),
        (b) => b.openArUsd,
      );
      return { region, count: list.length, arUsd, cArUsd, cShare: arUsd > 0 ? cArUsd / arUsd : null };
    })
    .sort((a, b) => b.arUsd - a.arUsd);
}

export function isGrade(v: unknown): v is Grade {
  return typeof v === "string" && (GRADES as string[]).includes(v);
}

/** grade가 S · A · B · C면 그 등급만, 아니면 전부. 순서는 topRisk와 같다. */
export function filterByGrade(buyers: Buyer[], grade?: string | null): Buyer[] {
  const list = isGrade(grade) ? buyers.filter((b) => b.grade === grade) : buyers;
  return [...list].sort(byRisk);
}
