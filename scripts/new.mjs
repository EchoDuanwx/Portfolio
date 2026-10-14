import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { collections, projectRoot, slugPattern } from './build.mjs';

export async function createPost(collection, slug, { root = projectRoot, now = new Date() } = {}) {
  if (!Object.hasOwn(collections, collection)) throw new Error('请选择栏目：projects / playground / articles。');
  if (typeof slug !== 'string' || !slugPattern.test(slug)) throw new Error('文件名只能使用小写英文字母、数字和连字符，例如 my-first-project。');
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const metadata = { title: '在这里写标题', date, summary: '用一句话介绍这篇文章。', tags: [], draft: true };
  const directory = path.join(root, 'content', collection);
  const filename = path.join(directory, `${slug}.md`);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(filename, `---\n${stringify(metadata)}---\n\n从这里开始写正文。\n\n## 一个小标题\n\n记录问题、过程，以及你的想法。\n`, { flag: 'wx' });
  } catch (error) { if (error.code === 'EEXIST') throw new Error(`文章已存在，没有覆盖：${filename}`); throw error; }
  return filename;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , collection, slug, ...extra] = process.argv;
    if (extra.length || !collection || !slug) throw new Error('用法：npm run new -- projects my-first-project');
    const filename = await createPost(collection, slug);
    console.log(`已创建草稿：${filename}\n写完后将 draft: true 改成 draft: false，即可发布。`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
