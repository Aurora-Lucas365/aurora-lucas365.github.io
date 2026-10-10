#!/usr/bin/env node
/**
 * 把 Obsidian 库里 publish: true 的笔记同步到网站仓库。
 *
 * 用法（在网站仓库根目录运行）：
 *   node scripts/sync-notes.mjs          正式同步
 *   node scripts/sync-notes.mjs --dry    只预览，不写文件
 *   node scripts/sync-notes.mjs --drafts 连草稿（publish 没勾）也同步，只用于本地预览：
 *                                        草稿写成 *.draft.md、图片放 public/notes/_drafts/，
 *                                        这两类文件被 .gitignore 排除，永远不会上传
 *
 * 配置：网站仓库根目录下的 sync.config.json
 *   { "vault": "E:/math model repository/数模" }
 *
 * 规则（和库里的「发布规则」一致）：
 *   - 只同步属性 publish 为 true 的笔记；其他一律跳过。
 *   - section 决定栏目：项目 → src/content/projects，历程 → src/content/journal，关于 → src/content/pages
 *   - 图片复制到 public/notes/<slug>/，正文里的链接自动改写；封面图如果也出现在正文里，正文那张会去掉，避免重复。
 *   - stats / specs / highlights 三个列表属性原样带过去，每一项写成「左边 | 右边」。
 *   - 指向未公开笔记的 [[双链]] 变成普通文字；%% 注释 %% 会被删掉。
 *   - 每次同步前清空上面这几个输出目录，所以取消 publish 的笔记会从网站上消失。
 *
 * 只用 Node 自带模块，不需要 npm install。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DRY = process.argv.includes("--dry");
const DRAFTS = process.argv.includes("--drafts");
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_FILE = path.join(SITE, "sync.config.json");

const SECTIONS = {
  项目: { dir: "src/content/projects", url: "/projects/" },
  历程: { dir: "src/content/journal", url: "/journal/" },
  关于: { dir: "src/content/pages", url: "/" },
};
const STATUS = ["进行中", "已完成", "暂停"];
const CATEGORY = ["嵌入式", "数学建模", "软件"];
const SKIP_DIRS = new Set([".obsidian", ".claudian", ".trash", ".git", "node_modules", "模板"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]);
const ASSET_DIR = "public/notes";
const LIST_FIELDS = ["stats", "specs", "highlights"];

/* ---------- 读取配置 ---------- */
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) fail(`找不到 ${CONFIG_FILE}。请新建它，内容如：{ "vault": "E:/math model repository/数模" }`);
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch (e) { fail(`sync.config.json 不是合法的 JSON：${e.message}`); }
  const vault = process.env.SYNC_VAULT || cfg.vault; // SYNC_VAULT 仅用于测试时临时指定库的位置
  if (!vault || !fs.existsSync(vault)) fail(`sync.config.json 里的 vault 路径不存在：${vault}`);
  return { vault: path.resolve(vault) };
}
function fail(msg) { console.error(`\n✕ ${msg}\n`); process.exit(1); }

/* ---------- 遍历库 ---------- */
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".") && ent.isDirectory()) continue;
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ---------- 极简 frontmatter 解析（支持本库用到的写法） ---------- */
function parseScalar(v) {
  v = v.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(",").map((x) => parseScalar(x)).filter((x) => x !== null) : [];
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/\s+#.*$/, "");
}
function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  let listKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = raw.match(/^\s+-\s*(.*)$/);
    if (item && listKey) { const v = parseScalar(item[1]); if (v !== null) data[listKey].push(v); continue; }
    const kv = raw.match(/^([^:\s][^:]*):\s?(.*)$/);
    if (!kv) { listKey = null; continue; }
    const key = kv[1].trim();
    if (kv[2].trim() === "") { data[key] = []; listKey = key; continue; }
    data[key] = parseScalar(kv[2]);
    listKey = null;
  }
  for (const k of Object.keys(data)) if (Array.isArray(data[k]) && data[k].length === 0 && k !== "tags") data[k] = null;
  return { data, body: text.slice(m[0].length) };
}

/* ---------- 工具 ---------- */
const baseName = (p) => path.basename(p, path.extname(p));
const asciiSlug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fmtDate = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v ?? "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
};
const yamlStr = (s) => JSON.stringify(String(s));
const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

/* ---------- 主流程 ---------- */
function main() {
  const { vault } = loadConfig();
  const files = walk(vault);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const attachments = new Map(); // 文件名 → 绝对路径（同名取第一个）
  for (const f of files) if (!f.endsWith(".md")) { const n = path.basename(f); if (!attachments.has(n)) attachments.set(n, f); }

  const errors = [], warnings = [], notes = [];

  // 第一遍：找出所有要公开的笔记，检查属性
  for (const file of mdFiles) {
    const rel = path.relative(vault, file).split(path.sep).join("/");
    const { data, body } = splitFrontmatter(fs.readFileSync(file, "utf8"));
    const isDraft = data.publish !== true;
    if (isDraft && !(DRAFTS && SECTIONS[data.section])) continue; // 草稿只在 --drafts 时带上
    const sec = SECTIONS[data.section];
    const problems = [];
    if (!sec) problems.push(`section 必须是 项目 / 历程 / 关于，现在是「${data.section ?? "空"}」`);
    if (!data.title) problems.push("缺少 title");
    if (data.section !== "关于") {
      if (!fmtDate(data.date)) problems.push("date 不是 YYYY-MM-DD 格式");
      if (!data.summary) problems.push("缺少 summary");
    }
    if (data.section === "项目") {
      if (!STATUS.includes(data.status)) problems.push(`status 要填 ${STATUS.join(" / ")}`);
      if (!CATEGORY.includes(data.category)) problems.push(`category 要填 ${CATEGORY.join(" / ")}`);
    }
    let slug = data.slug ? asciiSlug(String(data.slug)) : asciiSlug(baseName(file));
    if (!slug) problems.push("缺少 slug（文件名是中文时必须手动填，例如 desk-pet）");
    if (problems.length) {
      const msg = `${rel}\n    - ${problems.join("\n    - ")}`;
      if (isDraft) warnings.push(`草稿属性不完整，已跳过：${msg}`); else errors.push(msg);
      continue;
    }
    if (/（待补充/.test(body)) warnings.push(`${rel}：正文里还有「（待补充…）」占位`);
    const assetDir = isDraft ? `${ASSET_DIR}/_drafts/${slug}` : `${ASSET_DIR}/${slug}`;
    notes.push({ file, rel, data, body, sec, slug, isDraft, assetDir, name: baseName(file) });
  }

  // slug 不能重复
  const seen = new Map();
  for (const n of notes) {
    const key = n.sec.dir + "/" + n.slug;
    if (seen.has(key)) errors.push(`slug 重复：${n.rel} 和 ${seen.get(key)} 都是「${n.slug}」`);
    else seen.set(key, n.rel);
  }
  if (errors.length) {
    console.error("\n✕ 下面这些笔记的属性有问题，已跳过整个同步，改好后再运行：\n");
    errors.forEach((e) => console.error("  · " + e));
    process.exit(1);
  }

  const byName = new Map(notes.map((n) => [n.name, n]));
  const urlOf = (n) => (n.data.section === "关于" ? `/${n.slug}/` : `${n.sec.url}${n.slug}/`);

  // 清空输出目录
  if (!DRY) {
    for (const d of [...Object.values(SECTIONS).map((s) => s.dir), ASSET_DIR]) {
      fs.rmSync(path.join(SITE, d), { recursive: true, force: true });
      fs.mkdirSync(path.join(SITE, d), { recursive: true });
    }
  }

  const copied = new Set();
  const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
  const copyImage = (n, ref) => {
    const fileName = path.basename(ref.split("|")[0].split("#")[0].trim());
    // 优先找：相对路径 → 笔记旁边的「附件」文件夹 → 库里任意位置的同名文件
    const candidates = [path.resolve(path.dirname(n.file), ref), path.join(path.dirname(n.file), "附件", fileName)];
    const src = candidates.find(isFile) || attachments.get(fileName);
    if (!src) { warnings.push(`${n.rel}：找不到图片「${fileName}」`); return null; }
    const out = `${n.assetDir}/${fileName}`;
    if (!copied.has(out)) {
      if (!DRY) {
        fs.mkdirSync(path.join(SITE, n.assetDir), { recursive: true });
        fs.copyFileSync(src, path.join(SITE, out));
      }
      copied.add(out);
    }
    return "/" + encodePath(out.replace(/^public\//, ""));
  };

  for (const n of notes) {
    let body = n.body;
    body = body.replace(/%%[\s\S]*?%%/g, ""); // Obsidian 注释：不公开

    // 嵌入：![[图片.jpg]]、![[图片.jpg|300]]、![[笔记]]
    body = body.replace(/!\[\[([^\]]+)\]\]/g, (_, inner) => {
      const [target, opt] = inner.split("|");
      const ext = path.extname(target.split("#")[0]).toLowerCase();
      if (IMAGE_EXT.has(ext)) {
        const url = copyImage(n, target);
        if (!url) return "";
        const alt = opt && !/^\d+(x\d+)?$/.test(opt) ? opt : baseName(target);
        return `![${alt}](${url})`;
      }
      return `[[${target}]]`; // 嵌入笔记 → 当作普通双链处理
    });

    // 普通 Markdown 图片：![说明](附件/图片.jpg)
    body = body.replace(/!\[([^\]]*)\]\((?!https?:|\/)([^)\s]+)\)/g, (_, alt, ref) => {
      const url = copyImage(n, decodeURIComponent(ref));
      return url ? `![${alt}](${url})` : "";
    });

    // 双链：[[笔记]]、[[笔记|显示文字]]、[[笔记#标题]]
    body = body.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
      const [targetFull, alias] = inner.split("|");
      const [target] = targetFull.split("#");
      const name = path.basename(target.trim());
      const text = (alias || targetFull).trim();
      const hit = byName.get(name);
      return hit ? `[${text}](${urlOf(hit)})` : text;
    });

    // 提示框：> [!note] 标题 → > **标题**
    body = body.replace(/^>\s*\[!([a-zA-Z-]+)\][+-]?\s*(.*)$/gm, (_, type, title) => `> **${title || type}**\n>`);
    // 高亮：==文字== → <mark>
    body = body.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");

    const coverUrl = n.data.cover ? copyImage(n, String(n.data.cover)) : null;
    if (coverUrl) {
      const esc = coverUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      body = body.replace(new RegExp(`^!\\[[^\\]]*\\]\\(${esc}\\)[ \\t]*\\n?`, "m"), "");
    }

    const fm = ["---", `title: ${yamlStr(n.data.title)}`, `slug: ${n.slug}`];
    if (n.data.date) fm.push(`date: ${fmtDate(n.data.date)}`);
    if (n.data.summary) fm.push(`summary: ${yamlStr(n.data.summary)}`);
    if (n.data.status) fm.push(`status: ${yamlStr(n.data.status)}`);
    if (n.data.category) fm.push(`category: ${yamlStr(n.data.category)}`);
    const tags = Array.isArray(n.data.tags) ? n.data.tags : n.data.tags ? [n.data.tags] : [];
    fm.push(`tags: [${tags.map(yamlStr).join(", ")}]`);
    if (coverUrl) fm.push(`cover: ${yamlStr(coverUrl)}`);
    // 「左 | 右」格式的列表：stats 大数字、specs 参数表、highlights 关于页卡片
    for (const key of LIST_FIELDS) {
      const items = Array.isArray(n.data[key]) ? n.data[key].map(String) : n.data[key] ? [String(n.data[key])] : [];
      if (items.length) fm.push(`${key}: [${items.map(yamlStr).join(", ")}]`);
    }
    if (n.isDraft) fm.push("draft: true");
    fm.push("---", "", "");

    const out = path.join(SITE, n.sec.dir, `${n.slug}${n.isDraft ? ".draft" : ""}.md`);
    if (!DRY) fs.writeFileSync(out, fm.join("\n") + body.replace(/^\s+/, "").replace(/\n{3,}/g, "\n\n"), "utf8");
  }

  // 汇报
  const count = (s) => notes.filter((n) => n.data.section === s).length;
  console.log(`\n${DRY ? "【预览，没有写入文件】" : "✓ 同步完成"}${DRAFTS ? "（含草稿，仅本地预览）" : ""}`);
  console.log(`  项目 ${count("项目")} 篇 · 历程 ${count("历程")} 篇 · 关于 ${count("关于")} 篇 · 图片 ${copied.size} 张`);
  for (const n of notes) console.log(`  ${n.isDraft ? "草稿" : "公开"} · ${n.data.section}  ${n.rel}  →  ${urlOf(n)}`);
  if (warnings.length) { console.log("\n⚠ 提醒："); warnings.forEach((w) => console.log("  · " + w)); }
  if (!notes.length) console.log("\n  没有找到 publish: true 的笔记。在笔记属性里把 publish 打勾后再运行。");
  console.log("");
}

main();
