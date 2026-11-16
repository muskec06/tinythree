# Benchmark results

| scene | Three.js tokens | tinythree tokens | fewer tokens | without boilerplate* |
|---|---:|---:|---:|---:|
| atom | 636 | 234 | **2.7×** | 2.1× |
| building | 994 | 322 | **3.1×** | 2.6× |
| eiffel-tower | 3028 | 1117 | **2.7×** | 2.6× |
| giza-pyramids | 830 | 293 | **2.8×** | 2.3× |
| leaning-tower-pisa | 977 | 316 | **3.1×** | 2.6× |
| london-eye | 1011 | 305 | **3.3×** | 2.8× |
| solar-farm | 914 | 253 | **3.6×** | 3.0× |
| stonehenge | 1120 | 375 | **3.0×** | 2.6× |
| table-lamp | 968 | 256 | **3.8×** | 3.2× |
| vectors | 466 | 122 | **3.8×** | 2.5× |
| **total** | 10944 | 3593 | **3.0×** | 2.6× |

\* minus 156 tokens of renderer/controls/resize setup that every Three.js page needs and tinythree hides.

AI prompt that teaches the language (`ai/SYSTEM_PROMPT.md`): **1276 tokens**, sent once per conversation (and cacheable).
Average saving per scene: 735 tokens → the prompt pays for itself after ~2 scenes or edits.

Tokenizer: OpenAI o200k_base via js-tiktoken (Claude's tokenizer differs; ratios are similar because both are BPE).
