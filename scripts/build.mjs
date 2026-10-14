import { readFile, writeFile, readdir, mkdir, rm, cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { parseDocument } from 'yaml';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const collections = {
  projects: { key: 'projects', category: '项目手札' },
  playground: { key: 'experiments', category: '奇思妙想' },
  articles: { key: 'articles', category: '唱唱反调' },
};
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const themes = new Set(['finance', 'notes', 'culture', 'system', 'palette', 'type', 'dots']);
const demos = new Set(['palette', 'type', 'dots']);
const metadataFields = new Set(['title', 'date', 'summary', 'slug', 'updated', 'tags', 'category', 'draft', 'sample', 'featured', 'cover', 'coverAlt', 'theme', 'role', 'demo', 'demoUrl', 'year', 'subtitle', 'readTime']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (filename, message) => { throw new Error(`${filename}: ${message}`); };

function stringField(object, key, filename, { required = false, allowEmpty = false } = {}) {
  if (!own(object, key)) {
    if (required) fail(filename, `缺少 ${key} 字段。`);
    return undefined;
  }
  if (typeof object[key] !== 'string' || (!allowEmpty && !object[key].trim())) {
    fail(filename, `${key} 必须是${allowEmpty ? '' : '非空'}文字。`);
  }
  return object[key].trim();
}

function dateField(value, key, filename) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(filename, `${key} 必须是 YYYY-MM-DD 日期，例如 "2026-10-13"。`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(filename, `${key} 不是有效日期：${value}。`);
  }
  return value;
}

export function parsePost(source, filename, collection) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);
  if (!match) fail(filename, '文章需要以两行 --- 包裹的 YAML 信息开始。');
  let meta;
  try {
    const document = parseDocument(match[1], { version: '1.2', uniqueKeys: true, resolveKnownTags: false });
    if (document.errors.length || document.warnings.length) {
      throw document.errors[0] || document.warnings[0];
    }
    meta = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    fail(filename, `YAML 格式有误：${error.message}`);
  }
  if (!isObject(meta)) fail(filename, 'YAML 信息必须是字段列表。');
  for (const key of Object.keys(meta)) if (!metadataFields.has(key)) fail(filename, `未知字段 ${key}，请检查拼写或参考写作指南。`);
  const config = collections[collection];
  if (!config) fail(filename, `未知栏目：${collection}。`);
  const title = stringField(meta, 'title', filename, { required: true });
  const summary = stringField(meta, 'summary', filename, { required: true });
  const date = dateField(meta.date, 'date', filename);
  const slug = stringField(meta, 'slug', filename) || path.basename(filename, '.md');
  if (!slugPattern.test(slug)) fail(filename, 'slug / 文件名只能使用小写英文字母、数字和单个连字符。');
  for (const key of ['draft', 'sample', 'featured']) {
    if (own(meta, key) && typeof meta[key] !== 'boolean') fail(filename, `${key} 必须是 true 或 false。`);
  }
  const tags = meta.tags ?? [];
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !tag.trim())) {
    fail(filename, 'tags 必须是文字数组，例如 ["体验设计", "产品思考"]。');
  }
  const item = {
    slug, title, date, summary, subtitle: summary,
    category: stringField(meta, 'category', filename) || config.category,
    tags: tags.map(tag => tag.trim()),
    draft: meta.draft ?? false,
    sample: meta.sample ?? false,
    featured: meta.featured ?? false,
  };
  for (const key of ['theme', 'cover', 'coverAlt', 'role', 'year', 'demo', 'demoUrl']) {
    const value = stringField(meta, key, filename);
    if (value !== undefined) item[key] = value;
  }
  if (item.theme && !themes.has(item.theme)) fail(filename, `不支持的 theme：${item.theme}。`);
  if (own(meta, 'updated')) item.updated = dateField(meta.updated, 'updated', filename);
  if (item.updated && item.updated < item.date) fail(filename, 'updated 不能早于 date。');
  if (item.demo && !demos.has(item.demo)) fail(filename, `不支持的 demo：${item.demo}。`);
  if (item.demoUrl) {
    try {
      const url = new URL(item.demoUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch { fail(filename, 'demoUrl 必须是完整的 https:// 链接。'); }
  }
  return { item, markdown: match[2].trim() };
}

export function validateSite(config, filename = 'site.json') {
  if (!isObject(config) || !isObject(config.site) || !isObject(config.about)) fail(filename, '需要 site 和 about 两组配置。');
  const site = {};
  for (const key of ['name', 'englishName', 'designer', 'description']) {
    site[key] = stringField(config.site, key, filename, { required: true });
  }
  site.email = stringField(config.site, 'email', filename, { required: true, allowEmpty: true });
  if (site.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email)) fail(filename, 'email 格式无效；暂不展示邮箱时请填写空字符串。');
  const about = { intro: stringField(config.about, 'intro', filename, { required: true }) };
  if (!Array.isArray(config.about.paragraphs) || config.about.paragraphs.some(p => typeof p !== 'string' || !p.trim())) {
    fail(filename, 'about.paragraphs 必须是文字数组。');
  }
  about.paragraphs = config.about.paragraphs;
  if (!Array.isArray(config.about.principles)) fail(filename, 'about.principles 必须是数组。');
  about.principles = config.about.principles.map((principle, index) => {
    if (!isObject(principle)) fail(filename, `about.principles[${index}] 需要 title 和 text。`);
    return {
      title: stringField(principle, 'title', filename, { required: true }),
      text: stringField(principle, 'text', filename, { required: true }),
    };
  });
  return { site, about };
}

async function validateImage(source, root, filename) {
  if (/^https:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      if (url.username || url.password) throw new Error();
    } catch { fail(filename, `图片链接无效：${source}`); }
    return source;
  }
  let relative;
  try { relative = decodeURIComponent(source.split(/[?#]/)[0]).replace(/^\.\//, '').replace(/^\/(?!\/)/, ''); }
  catch { fail(filename, `图片路径无效：${source}`); }
  if (!relative.startsWith('assets/') || /[\\\x00-\x1f]/.test(relative)) {
    fail(filename, `图片请使用 ./assets/ 内的文件或 https:// 链接：${source}`);
  }
  const absolute = path.resolve(root, relative);
  const assetsRoot = `${path.resolve(root, 'assets')}${path.sep}`;
  if (!absolute.startsWith(assetsRoot)) fail(filename, `图片不能位于 assets 目录之外：${source}`);
  try {
    if (!(await stat(absolute)).isFile()) throw new Error();
  } catch { fail(filename, `找不到图片文件：${source}`); }
  // Site-relative paths keep images working on both username.github.io and repository subpaths.
  return `./${relative}${source.slice(source.split(/[?#]/)[0].length)}`;
}

function walkTokens(tokens, visit) {
  for (const token of tokens) {
    visit(token);
    if (token.children) walkTokens(token.children, visit);
  }
}

export function readTime(markdown) {
  const han = markdown.match(/\p{Script=Han}/gu)?.length || 0;
  const words = markdown.replace(/\p{Script=Han}/gu, ' ').match(/[\p{L}\p{N}]+/gu)?.length || 0;
  return `${Math.max(1, Math.ceil(han / 400 + words / 220))} 分钟`;
}

async function renderPost(post, root, filename) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  const tokens = md.parse(post.markdown, {});
  const images = [];
  walkTokens(tokens, token => { if (token.type === 'image') images.push(token); });
  for (const token of images) {
    token.attrSet('src', await validateImage(token.attrGet('src'), root, filename));
    token.attrSet('loading', 'lazy');
    token.attrSet('decoding', 'async');
  }
  if (post.item.cover) post.item.cover = await validateImage(post.item.cover, root, filename);
  return { ...post.item, readTime: readTime(post.markdown), bodyHtml: md.renderer.render(tokens, md.options, {}) };
}

export function serializeData(data) {
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `// Generated by npm run build. Edit content/**/*.md and site.json instead.\nwindow.PORTFOLIO = ${json};\n`;
}

export async function loadContent(root = projectRoot) {
  let config;
  try { config = JSON.parse(await readFile(path.join(root, 'site.json'), 'utf8')); }
  catch (error) { fail('site.json', `无法读取配置：${error.message}`); }
  const data = validateSite(config);
  for (const [collection, config] of Object.entries(collections)) {
    const directory = path.join(root, 'content', collection);
    let filenames;
    try { filenames = (await readdir(directory)).filter(file => file.endsWith('.md')).sort(); }
    catch (error) { if (error.code === 'ENOENT') filenames = []; else throw error; }
    const seen = new Map();
    const published = [];
    for (const filename of filenames) {
      const relative = `content/${collection}/${filename}`;
      const source = await readFile(path.join(directory, filename), 'utf8');
      const post = parsePost(source, relative, collection);
      if (seen.has(post.item.slug)) fail(relative, `slug "${post.item.slug}" 重复，已用于 ${seen.get(post.item.slug)}。`);
      seen.set(post.item.slug, relative);
      if (post.item.draft) continue;
      published.push({ filename, item: await renderPost(post, root, relative) });
    }
    published.sort((a, b) => b.item.date.localeCompare(a.item.date) || (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0));
    data[config.key] = published.map(post => post.item);
  }
  return data;
}

export async function buildSite({ root = projectRoot, outDir = path.join(root, 'dist'), writeRoot = true } = {}) {
  root = path.resolve(root);
  outDir = path.resolve(outDir);
  if (outDir !== path.join(root, 'dist')) throw new Error('构建目录必须是项目内的 dist，避免覆盖源文件。');
  const data = await loadContent(root);
  const generated = serializeData(data);
  const staticFiles = ['index.html', 'styles.css', 'app.js', 'favicon.svg'];
  // Check inputs before replacing the last successful build.
  for (const name of staticFiles) await stat(path.join(root, name));
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const name of staticFiles) await cp(path.join(root, name), path.join(outDir, name));
  try { await cp(path.join(root, 'assets'), path.join(outDir, 'assets'), { recursive: true, dereference: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(path.join(outDir, '.nojekyll'), '');
  await writeFile(path.join(outDir, 'content.js'), generated);
  if (writeRoot) await writeFile(path.join(root, 'content.js'), generated);
  return { data, outDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { data, outDir } = await buildSite();
    console.log(`已生成 ${outDir}\n项目手札 ${data.projects.length} 篇 · 奇思妙想 ${data.experiments.length} 篇 · 唱唱反调 ${data.articles.length} 篇（草稿已排除）`);
  } catch (error) { console.error(`构建失败：${error.message}`); process.exitCode = 1; }
}
