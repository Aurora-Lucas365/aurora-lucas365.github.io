// 几个各页面都会用到的小工具和常量
export const SITE_NAME = "Lucas Taylor";

export const CONTACT = {
  email: "wyn070520@outlook.com",
  github: "https://github.com/Aurora-Lucas365",
  douyin: "https://v.douyin.com/5S9U9VEZd6s/",
};

/** 项目分类的固定顺序，和颜色对应的 CSS 类名（颜色写在 Base.astro 里） */
export const CATEGORIES = ["嵌入式", "数学建模", "软件"] as const;
export const CATEGORY_CLASS: Record<string, string> = { 嵌入式: "c-emb", 数学建模: "c-math", 软件: "c-soft" };

/** 状态前面的小符号：实心 = 已完成，半实心 = 进行中，空心 = 暂停 */
export const STATUS_ICON: Record<string, string> = { 已完成: "●", 进行中: "◐", 暂停: "○" };
export const STATUS_CLASS: Record<string, string> = { 已完成: "s-done", 进行中: "s-doing", 暂停: "s-paused" };

/** 2026-10-09 这样的日期格式 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 按日期从新到旧排序 */
export function byDateDesc<T extends { data: { date: Date } }>(a: T, b: T): number {
  return b.data.date.getTime() - a.data.date.getTime();
}

/** 把「左边 | 右边」拆成两半；没有竖线时右边为空 */
export function splitPair(s: string): [string, string] {
  const i = s.indexOf("|");
  return i < 0 ? [s.trim(), ""] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}
