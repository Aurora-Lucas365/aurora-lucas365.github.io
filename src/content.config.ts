// 告诉 Astro：笔记放在哪、每篇笔记有哪些属性。
// 这些 .md 文件由 scripts/sync-notes.mjs 从 Obsidian 同步过来，不要手动改。
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const common = {
  title: z.string(),
  slug: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  draft: z.boolean().default(false),
  // 下面三个都是「左边 | 右边」格式的列表，可以不填
  stats: z.array(z.string()).default([]), // 项目页的大数字，如「5 | 个 SG90 舵机」
  specs: z.array(z.string()).default([]), // 项目页的参数表，如「尾巴舵机 | PA6」
  highlights: z.array(z.string()).default([]), // 关于页的卡片，如「英语 | 已过六级」
};

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    ...common,
    date: z.coerce.date(),
    status: z.enum(["进行中", "已完成", "暂停"]),
    category: z.enum(["嵌入式", "数学建模", "软件"]),
  }),
});

const journal = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/journal" }),
  schema: z.object({ ...common, date: z.coerce.date() }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({ ...common, date: z.coerce.date().optional() }),
});

export const collections = { projects, journal, pages };
