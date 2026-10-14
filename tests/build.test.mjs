import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { stringify } from 'yaml';
import { buildSite, loadContent, parsePost, serializeData, validateSite } from '../scripts/build.mjs';
import { createPost } from '../scripts/new.mjs';

const config = { site: { name: 'Wenx', englishName: 'WENX', designer: 'Wenx', email: '', description: '设计手札' }, about: { intro: '关于我', paragraphs: ['一段介绍'], principles: [{ title: '好奇', text: '继续探索' }] } };
const front = { title: '设计记录', date: '2026-10-13', summary: '一次探索' };
const document = (meta = {}, body = '## 开始\n\n记录一点想法。') => `---\n${stringify({ ...front, ...meta })}---\n\n${body}\n`;

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'wenx-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(['projects', 'playground', 'articles'].map(name => mkdir(path.join(root, 'content', name), { recursive: true })));
  await writeFile(path.join(root, 'site.json'), JSON.stringify(config));
  for (const filename of ['index.html', 'app.js', 'styles.css', 'favicon.svg']) await writeFile(path.join(root, filename), `fixture ${filename}`);
  return { root, post: (collection, filename, meta = {}, body) => writeFile(path.join(root, 'content', collection, `${filename}.md`), document(meta, body)) };
}

test('articles are added, edited and sorted by date with stable filename ties', async t => {
  const { root, post } = await fixture(t);
  await post('projects', 'z-first', { date: '2026-01-01' });
  await post('projects', 'b-second', { title: 'B', date: '2026-05-01' });
  await post('projects', 'a-third', { title: 'A', date: '2026-05-01' });
  await post('playground', 'an-experiment');
  await post('articles', 'an-article');
  let data = await loadContent(root);
  assert.deepEqual(data.projects.map(post => post.slug), ['a-third', 'b-second', 'z-first']);
  assert.equal(data.experiments[0].category, '奇思妙想');
  assert.equal(data.articles[0].category, '唱唱反调');
  assert.equal(data.projects[0].theme, undefined);
  await post('projects', 'z-first', { date: '2026-10-01', title: '修改后的标题', summary: '新的摘要' }, '更新后的正文。');
  data = await loadContent(root);
  assert.equal(data.projects[0].title, '修改后的标题');
  assert.equal(data.projects[0].subtitle, '新的摘要');
  assert.match(data.projects[0].bodyHtml, /更新后的正文/);
});

test('public output excludes draft content and source files; removing a post rebuilds cleanly', async t => {
  const { root, post } = await fixture(t);
  await post('projects', 'public-post');
  await post('articles', 'secret-draft', { draft: true, title: 'PRIVATE_TITLE' }, 'PRIVATE_BODY');
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'assets', 'cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await mkdir(path.join(root, 'content', '_templates'));
  await writeFile(path.join(root, 'content', '_templates', 'unfinished.md'), 'NOT_VALID_FRONTMATTER');
  const first = await buildSite({ root });
  assert.equal(first.data.projects.length, 1);
  assert.equal(first.data.articles.length, 0);
  const output = await readFile(path.join(root, 'dist', 'content.js'), 'utf8');
  assert.doesNotMatch(output, /PRIVATE_|secret-draft/);
  assert.equal(output, await readFile(path.join(root, 'content.js'), 'utf8'));
  assert.deepEqual((await readdir(path.join(root, 'dist'))).sort(), ['.nojekyll', 'app.js', 'assets', 'content.js', 'favicon.svg', 'index.html', 'styles.css']);
  await writeFile(path.join(root, 'dist', 'obsolete.html'), 'stale content');
  await rm(path.join(root, 'content', 'projects', 'public-post.md'));
  const second = await buildSite({ root });
  assert.equal(second.data.projects.length, 0);
  assert.ok(!(await readdir(path.join(root, 'dist'))).includes('obsolete.html'));
  await assert.rejects(buildSite({ root, outDir: root }), /dist/);
});

test('switching a published post to draft removes it from both generated files', async t => {
  const { root, post } = await fixture(t);
  await post('articles', 'visible-post', {}, 'WAS_PUBLIC_BODY');
  await buildSite({ root });
  await post('articles', 'visible-post', { draft: true }, 'WAS_PUBLIC_BODY');
  await buildSite({ root });
  for (const filename of ['content.js', 'dist/content.js']) assert.doesNotMatch(await readFile(path.join(root, filename), 'utf8'), /WAS_PUBLIC_BODY|visible-post/);
});

test('Markdown renders headings, links, images, lists, quotes, code, tables; raw HTML remains text', async t => {
  const { root, post } = await fixture(t);
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'assets', 'process.svg'), '<svg/>');
  const body = '## 过程\n\n**强调**与[链接](https://example.com)\n\n![过程图](/assets/process.svg)\n\n- 第一项\n- 第二项\n\n> 引用\n\n```js\nconst x = "<script>";\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))';
  await post('articles', 'rich-content', { cover: './assets/process.svg', tags: ['探索'] }, body);
  const article = (await loadContent(root)).articles[0];
  assert.match(article.bodyHtml, /<h2>过程<\/h2>/);
  assert.match(article.bodyHtml, /<a href="https:\/\/example.com">链接<\/a>/);
  assert.match(article.bodyHtml, /<img src="\.\/assets\/process.svg" alt="过程图" loading="lazy" decoding="async">/);
  for (const tag of ['ul', 'blockquote', 'table']) assert.match(article.bodyHtml, new RegExp(`<${tag}>`));
  assert.match(article.bodyHtml, /<pre><code class="language-js">/);
  assert.match(article.bodyHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(article.bodyHtml, /<script>|href="javascript:/);
  assert.match(article.readTime, /^\d+ 分钟$/);
});

test('front matter validation identifies the file and field', () => {
  const filename = 'content/projects/my-post.md';
  for (const [meta, field] of [
    [{ title: null }, 'title'], [{ summary: '' }, 'summary'], [{ date: '2026-02-30' }, 'date'],
    [{ date: 20261013 }, 'date'], [{ draft: 'false' }, 'draft'], [{ draff: true }, 'draff'], [{ tags: 'design' }, 'tags'],
    [{ slug: '../escape' }, 'slug'], [{ theme: 'unknown' }, 'theme'], [{ demo: 'unknown' }, 'demo'],
    [{ updated: '2026-01-01' }, 'updated'], [{ demoUrl: 'javascript:alert(1)' }, 'demoUrl'],
  ]) assert.throws(() => parsePost(document(meta), filename, 'projects'), error => error.message.includes(filename) && error.message.includes(field));
  assert.throws(() => parsePost('no frontmatter', filename, 'projects'), /YAML/);
  assert.throws(() => parsePost('---\ntitle: x\ntitle: y\n---\ntext', filename, 'projects'), /YAML/);
  assert.equal(parsePost(document(), '2026-10-13-a-post.md', 'projects').item.slug, '2026-10-13-a-post');
  assert.equal(parsePost(document({ date: '2024-02-29' }), filename, 'projects').item.date, '2024-02-29');
  assert.throws(() => validateSite({ ...config, site: { ...config.site, email: 'bad-address' } }), /site.json.*email/);
});

test('duplicate slugs fail only within the same collection', async t => {
  const { root, post } = await fixture(t);
  await post('projects', 'first', { slug: 'shared-slug' });
  await post('articles', 'first', { slug: 'shared-slug' });
  await loadContent(root);
  await post('projects', 'second', { slug: 'shared-slug' });
  await assert.rejects(loadContent(root), /content\/projects\/second.md.*slug.*first.md/);
});

test('missing local images and unsafe covers fail with useful errors', async t => {
  const { root, post } = await fixture(t);
  await post('articles', 'broken-image', {}, '![missing](./assets/missing.png)');
  await assert.rejects(loadContent(root), /broken-image.md.*找不到图片文件/);
  for (const cover of ['javascript:alert(1)', '//example.com/image.png', 'data:image/svg+xml;base64,abc', './assets/../../site.json']) {
    await post('articles', 'broken-image', { cover });
    await assert.rejects(loadContent(root), /broken-image.md.*图片/);
  }
});

test('generated JavaScript is safe to inline and preserves text exactly', () => {
  const payload = { title: '</script><script>alert("x")</script>\u2028\u2029', articles: [] };
  const source = serializeData(payload);
  assert.doesNotMatch(source, /<\/script|\u2028|\u2029/);
  assert.match(source, /\\u003c/);
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  assert.equal(sandbox.window.PORTFOLIO.title, payload.title);
});

test('new article command makes an unpublished draft and refuses traversal or overwrites', async t => {
  const { root } = await fixture(t);
  const filename = await createPost('projects', 'my-first-post', { root, now: new Date(2026, 9, 13) });
  const parsed = parsePost(await readFile(filename, 'utf8'), filename, 'projects');
  assert.equal(parsed.item.draft, true);
  assert.equal(parsed.item.date, '2026-10-13');
  assert.equal((await loadContent(root)).projects.length, 0);
  await assert.rejects(createPost('projects', 'my-first-post', { root }), /已存在/);
  await assert.rejects(createPost('projects', '../outside', { root }), /文件名/);
  await assert.rejects(createPost('__proto__', 'outside', { root }), /栏目/);
});
