/**
 * 应急推送通道：本机 git 到 github.com:443 直连超时、gh-proxy 镜像拒绝带令牌推送时，
 * 改用 GitHub REST API 逐对象提交（api.github.com 可达，gh 已登录）。
 * 用法：node scripts/api-push.mjs "<commit message>"
 * 逻辑：拉取远端 main 树 → 与本地工作区逐文件比 git blob sha → 只上传差异 → 建 commit → 更新 ref。
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const REPO = 'ccxxxx-create/verdant';
const BRANCH = 'main';
const TOKEN = execSync('gh auth token', { encoding: 'utf8' }).trim();

const SKIP_TOP = new Set(['.git', 'node_modules', 'dist', '.vite', '.mimosa', 'coverage', '.DS_Store']);
const SKIP_PREFIX = ['docs/_review/'];

function walk(dir, out = [], rel = '') {
  for (const name of readdirSync(dir)) {
    if (SKIP_TOP.has(name)) continue;
    const p = join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    if (SKIP_PREFIX.some((pre) => relPath.startsWith(pre))) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out, relPath);
    else if (st.isFile()) out.push(p);
  }
  return out;
}

const gitBlobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

// 1. 远端 ref 与树
const ref = await api(`/git/ref/heads/${BRANCH}`);
const baseCommitSha = ref.object.sha;
const baseCommit = await api(`/git/commits/${baseCommitSha}`);
const baseTreeSha = baseCommit.tree.sha;
const remoteFiles = await api(`/git/trees/${baseTreeSha}?recursive=1`);
const remoteMap = new Map(remoteFiles.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t.sha]));

// 2. 本地文件 → git blob sha
const local = walk(root);
const localMap = new Map();
const contents = new Map();
for (const p of local) {
  const rel = relative(root, p).split(sep).join('/');
  const buf = readFileSync(p);
  localMap.set(rel, gitBlobSha(buf));
  contents.set(rel, buf);
}

// 3. 差异集合（新增/修改/删除）。删除=远端有、本地没有（本地跳过目录不进 localMap，自然成删除项）
const changed = [];
for (const [path, sha] of localMap) {
  if (remoteMap.get(path) !== sha) changed.push(path);
}
const deleted = [...remoteMap.keys()].filter((p) => !localMap.has(p));

console.log(`changed: ${changed.length}, deleted: ${deleted.length}`);
if (changed.length === 0 && deleted.length === 0) {
  console.log('nothing to push');
  process.exit(0);
}

// 4. 上传差异 blob
for (const path of changed) {
  await api(`/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content: contents.get(path).toString('base64'),
      encoding: 'base64',
    }),
  });
  console.log(`blob ↑ ${path}`);
}

// 5. 建树（base_tree + 全量路径，删除项用 sha: null）
const tree = [
  ...changed.map((path) => ({ path, mode: '100644', type: 'blob', sha: localMap.get(path) })),
  ...deleted.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
];
const newTree = await api('/git/trees', {
  method: 'POST',
  body: JSON.stringify({ base_tree: baseTreeSha, tree }),
});

// 6. commit + 更新 ref
const message = process.argv[2] ?? 'chore: api push';
const commit = await api('/git/commits', {
  method: 'POST',
  body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
});
await api(`/git/refs/heads/${BRANCH}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
});
console.log(`pushed ${commit.sha} → ${BRANCH}`);
