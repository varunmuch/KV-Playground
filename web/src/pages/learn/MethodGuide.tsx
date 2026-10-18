import type { LayoutMethod } from '../../simulator';

interface Guide {
  name: string;
  idea: string;
  steps: string[];
  good: string[];
  costs: string[];
  usedIn: string;
}

const GUIDES: Record<LayoutMethod, Guide> = {
  dynamic: {
    name: 'Dynamic cache',
    idea: 'Keep each person’s keys and values in one continuous block of memory, and make it bigger every time a token is added.',
    steps: [
      'Prefill: for every attention layer, the keys and values of all prompt tokens are stored side by side in one block.',
      'Decoding: the new token’s key and value are computed.',
      'A new block one slot bigger is allocated, the old contents are copied into it, and the new token goes at the end (in PyTorch, torch.cat). The old block is freed.',
      'Attention reads the whole block, which is easy because it’s all in one piece.',
    ],
    good: ['No wasted slots: memory used equals memory allocated.', 'Simple, and nothing needs to be known in advance.'],
    costs: [
      'Every step copies the whole cache, and the copy grows with every token.',
      'Memory sizes change every step, so compilers (torch.compile, CUDA graphs) can’t optimise the model ahead of time.',
      'Constantly allocating and freeing blocks of different sizes leaves gaps in GPU memory when many people are served.',
    ],
    usedIn: 'The default cache in Hugging Face transformers (DynamicCache), and most research code.',
  },
  static: {
    name: 'Static cache',
    idea: 'Reserve the maximum space a person could ever need the moment they arrive, then fill it in place.',
    steps: [
      'When a request starts, a fixed area is reserved for every layer: room for the prompt plus the longest answer allowed.',
      'Prefill writes the prompt’s keys and values into the first slots.',
      'Each decoding step writes one new key and value into the next empty slot. Nothing moves.',
      'Attention reads the whole area, using a mask to ignore the empty slots.',
    ],
    good: [
      'No copying, ever.',
      'Memory shapes never change, so the model can be compiled once (torch.compile, CUDA graphs) and run much faster, especially for one person at a time.',
      'Memory use is predictable.',
    ],
    costs: [
      'Most of the reserved space usually sits empty. That’s fragmentation, and it means fewer people fit on the GPU.',
      'You must choose a maximum length up front. On the Benchmarks page the static cache reserves room for a 1,024-token answer; compare its “KV cache size” with the others.',
    ],
    usedIn: 'Hugging Face StaticCache, on-device and compiled inference, and many early serving systems.',
  },
  paged: {
    name: 'Paged cache (PagedAttention)',
    idea: 'Borrow an idea from operating systems: cut memory into small fixed-size blocks, and give each person blocks only as they need them.',
    steps: [
      'All cache memory is one shared pool of blocks, each holding a fixed number of tokens (often 16).',
      'Each person has a block table: block 1 of their tokens lives in pool block 7, block 2 in pool block 3, and so on.',
      'When a person’s last block is full, any free block from the pool is handed out. It doesn’t need to be next to the others.',
      'A special attention kernel follows the block table to find each token’s keys and values.',
      'When the person is done, their blocks go back to the pool for someone else.',
    ],
    good: [
      'Waste is at most one partly filled block per person.',
      'No copying when a cache grows.',
      'Many more people fit on one GPU, so the server answers more requests per second. The vLLM paper reported 2–4× more throughput than earlier systems.',
    ],
    costs: [
      'Attention must look up every block through the table, which needs a custom kernel.',
      'Block size is a trade-off: bigger blocks waste more at the end, smaller blocks mean longer tables. Try it with the block size setting above.',
    ],
    usedIn: 'vLLM (which introduced PagedAttention), SGLang, TensorRT-LLM and Hugging Face TGI.',
  },
  prefix: {
    name: 'Prefix sharing (prefix caching)',
    idea: 'Paged blocks that hold the same tokens are the same data, so when two prompts start the same way, store and compute those blocks once.',
    steps: [
      'When a block fills up, it’s registered under a fingerprint (a hash) of its tokens and every token before it.',
      'A new request computes the fingerprints of its own prompt blocks and looks them up.',
      'Every block that matches is reused: its block table simply points at the existing block, and a counter records how many people use it.',
      'Only the tokens after the last matching block go through prefill.',
      'When memory runs low, blocks nobody is using are removed, oldest first.',
    ],
    good: [
      'Skips prefill for the shared part, so the first word arrives sooner. Long system prompts, chat history, agents and documents benefit most.',
      'Shared blocks are stored once, saving memory.',
    ],
    costs: [
      'Only exact matches from the very first token count. One changed word early in the prompt breaks the match for everything after it.',
      'Only whole blocks are shared, so up to one block of shared tokens is computed again.',
      'Shared blocks must stay in memory to be useful, which competes with new requests for space.',
    ],
    usedIn: 'vLLM automatic prefix caching, SGLang RadixAttention, and the prompt-caching features of the Anthropic and OpenAI APIs.',
  },
};

const COMPARE: { method: LayoutMethod; wasted: string; copying: string; reuse: string; best: string }[] = [
  { method: 'dynamic', wasted: 'None', copying: 'Whole cache, every step', reuse: 'No', best: 'Simple scripts, one person at a time' },
  { method: 'static', wasted: 'Most of the reservation', copying: 'None', reuse: 'No', best: 'Compiled models, phones and laptops' },
  { method: 'paged', wasted: 'Under one block per person', copying: 'None', reuse: 'No', best: 'Servers with many people at once' },
  { method: 'prefix', wasted: 'Under one block per person', copying: 'None', reuse: 'Yes, shared prompt starts', best: 'Chatbots, agents, shared documents' },
];

export function MethodGuide({ method }: { method: LayoutMethod }) {
  const guide = GUIDES[method];
  return (
    <div className="guide">
      <article className="card guide__card" aria-labelledby="guide-title">
        <p className="eyebrow">How it works</p>
        <h3 id="guide-title" className="guide__title">{guide.name}</h3>
        <p className="guide__idea">{guide.idea}</p>
        <ol className="guide__steps">
          {guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="guide__columns">
          <div>
            <p className="guide__label">Good at</p>
            <ul className="plain-list">
              {guide.good.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="guide__label">Costs</p>
            <ul className="plain-list">
              {guide.costs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="small muted">
          <strong>Used in:</strong> {guide.usedIn}
        </p>
      </article>

      <div className="table-scroll" role="region" aria-label="The four methods compared" tabIndex={0}>
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">Wasted memory</th>
              <th scope="col">Copying</th>
              <th scope="col">Reuses work across people</th>
              <th scope="col">Best for</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((row) => (
              <tr key={row.method} className={row.method === method ? 'is-highlighted' : undefined}>
                <th scope="row">{GUIDES[row.method].name}</th>
                <td>{row.wasted}</td>
                <td>{row.copying}</td>
                <td>{row.reuse}</td>
                <td>{row.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
