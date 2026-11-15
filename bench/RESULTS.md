# Benchmark results

| scene | Three.js tokens | tinythree tokens | fewer tokens | without boilerplate* |
|---|---:|---:|---:|---:|
| atom | 636 | 234 | **2.7×** | 2.1× |
| building | 994 | 322 | **3.1×** | 2.6× |
| solar-farm | 914 | 253 | **3.6×** | 3.0× |
| table-lamp | 968 | 256 | **3.8×** | 3.2× |
| vectors | 466 | 122 | **3.8×** | 2.5× |
| **total** | 3978 | 1187 | **3.4×** | 2.7× |

\* minus 156 tokens of renderer/controls/resize setup that every Three.js page needs and tinythree hides.

AI prompt that teaches the language (`ai/SYSTEM_PROMPT.md`): **1112 tokens**, sent once per conversation (and cacheable).
Average saving per scene: 558 tokens → the prompt pays for itself after ~2 scenes or edits.

Tokenizer: OpenAI o200k_base via js-tiktoken (Claude's tokenizer differs; ratios are similar because both are BPE).
