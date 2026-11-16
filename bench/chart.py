"""Draw docs/benchmark.png from bench/results.json  (python bench/chart.py)."""
import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, 'bench', 'results.json')))
rows = sorted(data['rows'], key=lambda r: r['js'])

SURFACE, INK, INK2, GRID = '#fcfcfb', '#0b0b0b', '#52514e', '#e6e5e1'
THREE, TINY = '#eb6834', '#2a78d6'   # categorical slots 2 and 1 (validated pair)
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11})

fig, ax = plt.subplots(figsize=(10, 6.2), dpi=160)
fig.patch.set_facecolor(SURFACE); ax.set_facecolor(SURFACE)
y = range(len(rows)); h = 0.36
ax.barh([i + h / 2 + 0.02 for i in y], [r['js'] for r in rows], h, color=THREE, label='hand-written Three.js')
ax.barh([i - h / 2 - 0.02 for i in y], [r['t3'] for r in rows], h, color=TINY, label='tinythree')
for i, r in enumerate(rows):
    ax.text(r['js'] + 18, i + h / 2 + 0.02, f"{r['js']}", va='center', color=INK2, fontsize=9.5)
    ax.text(r['t3'] + 18, i - h / 2 - 0.02, f"{r['t3']}  ·  {r['ratio']:.1f}× fewer", va='center', color=INK, fontsize=9.5)
ax.set_yticks(list(y)); ax.set_yticklabels([r['name'] for r in rows], color=INK)
ax.set_xlabel('output tokens (o200k tokenizer)', color=INK2)
ax.tick_params(colors=INK2, length=0)
ax.xaxis.grid(True, color=GRID, linewidth=1); ax.set_axisbelow(True)
for s in ax.spines.values(): s.set_visible(False)
ax.set_xlim(0, max(r['js'] for r in rows) * 1.12)
t = data['total']
fig.suptitle(f"Same scene, {t['ratio']:.1f}× fewer tokens", x=0.02, ha='left', fontsize=16, fontweight='bold', color=INK)
ax.set_title(f"{len(rows)} scenes · {t['js']:,} → {t['t3']:,} tokens in total", loc='left', color=INK2, fontsize=11, pad=10)
ax.legend(loc='lower right', frameon=False, labelcolor=INK)
fig.tight_layout()
fig.savefig(os.path.join(ROOT, 'docs', 'benchmark.png'), facecolor=SURFACE)
print('wrote docs/benchmark.png')
