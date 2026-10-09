// 几个各页面都会用到的小工具
export const SITE_NAME = "Lucas Taylor";

/** 2026-10-09 这样的日期格式 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 按日期从新到旧排序 */
export function byDateDesc<T extends { data: { date: Date } }>(a: T, b: T): number {
  return b.data.date.getTime() - a.data.date.getTime();
}
