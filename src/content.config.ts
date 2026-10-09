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
