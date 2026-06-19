import fs from 'fs';
import path from 'path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')), 'results');
const models = [
  'deepseek/deepseek-v4-flash',
  'openai/gpt-4o-mini',
  'google/gemini-2.5-flash-lite',
  'qwen/qwen3.5-flash-02-23',
];
const urls = ['cookidoo r57645', 'paulina budin naranja', 'cookpad 17124999'];

function summarize(r) {
  if (!r || r.success === false || !r.recipe) {
    return { ok: false, err: r?.error || 'no recipe' };
  }
  const rec = r.recipe;
  const ings = rec.ingredients || [];
  const steps = rec.instructions || [];
  const tmxFns = steps.filter(s => s.function).length;
  const sections = new Set([...ings, ...steps].map(x => x.section).filter(Boolean));
  return {
    ok: true,
    title: rec.title,
    ings: ings.length,
    steps: steps.length,
    servings: rec.servings,
    prep: rec.prepTime,
    cook: rec.cookTime,
    diff: rec.difficulty,
    type: rec.recipeType,
    tags: (rec.tags || []).length,
    imgs: (rec.images || []).length,
    tmxFns,
    sections: sections.size,
  };
}

const data = [];
for (let m = 0; m < 4; m++) {
  for (let u = 0; u < 3; u++) {
    const f = path.join(dir, `m${m}_u${u}.json`);
    let wrap;
    try { wrap = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { wrap = null; }
    const s = summarize(wrap?.response);
    data.push({ m, u, elapsed: wrap?.elapsed, ...s });
  }
}

// Per-URL tables
for (let u = 0; u < 3; u++) {
  console.log(`\n### URL ${u}: ${urls[u]}`);
  console.log('| Modelo | OK | Título | Ingr | Pasos | Porc | Prep | Cook | Dificultad | Tipo | Tags | TMX fns | Secc | Seg |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (let m = 0; m < 4; m++) {
    const d = data.find(x => x.m === m && x.u === u);
    if (!d.ok) {
      console.log(`| ${models[m]} | ❌ | ${d.err} | | | | | | | | | | | ${d.elapsed} |`);
    } else {
      console.log(`| ${models[m]} | ✅ | ${(d.title||'').slice(0,40)} | ${d.ings} | ${d.steps} | ${d.servings} | ${d.prep} | ${d.cook} | ${d.diff} | ${d.type} | ${d.tags} | ${d.tmxFns} | ${d.sections} | ${d.elapsed} |`);
    }
  }
}

// Avg latency
console.log('\n### Latencia promedio por modelo');
for (let m = 0; m < 4; m++) {
  const rows = data.filter(x => x.m === m);
  const oks = rows.filter(x => x.ok).length;
  const avg = (rows.reduce((a, x) => a + (Number(x.elapsed) || 0), 0) / rows.length).toFixed(1);
  console.log(`- ${models[m]}: ${oks}/3 ok, avg ${avg}s`);
}
