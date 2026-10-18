import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { Term } from '../../components/Term';
import { formatBytes, formatInt } from '../../lib/format';
import type { ModelFacts } from '../../qwen/model';
import { Chapter } from './Chapter';

const USERS = [1, 10, 100];

export function MemoryChapter({ facts }: { facts: ModelFacts }) {
  const perToken = facts.kvBytesPerToken;
  const maxContext = facts.maxContext ?? 32768;
  const contexts = [1000, 8192, 32768, 131072, maxContext].filter((n, i, all) => n <= maxContext && all.indexOf(n) === i);
  const [context, setContext] = useState(contexts[1] ?? contexts[0]);
  const [users, setUsers] = useState(1);
  const total = (perToken * context + facts.fixedStateBytes) * users;

  const factors = [
    { value: '2', label: 'a key and a value' },
    { value: String(facts.fullAttentionLayers), label: 'layers that keep them' },
    { value: String(facts.numKvHeads), label: 'sets per layer' },
    { value: String(facts.headDim), label: 'numbers in each' },
    { value: String(facts.bytesPerElement), label: 'bytes per number' },
  ];

  return (
    <Chapter
      id="memory"
      number={5}
      title="The cost: memory"
      summary="The cache saves work, but it has to live in GPU memory. Every token adds the same number of bytes."
      terms={[
        ['GPU memory (VRAM)', 'The fast memory on the graphics card where the model and its cache live. It is limited.'],
        ['Precision (bf16)', 'How many bits each number uses. bf16 is 16 bits, or 2 bytes.'],
        ['Context length', 'How many tokens a conversation holds: prompt plus answer so far.'],
        ['Batch', 'Several people’s requests handled at once. Each one needs its own cache.'],
      ]}
    >
      <p>
        The cache lives in <Term>GPU memory</Term> (VRAM), which is fast but limited. Each number is stored in{' '}
        <Term>bf16</Term> precision: 16 bits, or 2 bytes. Here is how many bytes one token’s keys and values take:
      </p>

      <div className="card lesson-card">
        <div className="figure-head">
          <p className="figure-head__title">Bytes per token</p>
          <Badge kind="theoretical">Calculated from the model’s config</Badge>
        </div>
        <div className="formula" role="group" aria-label="Bytes per token">
          {factors.map((f, i) => (
            <div key={f.label} className="formula__part">
              {i > 0 && <span className="formula__op" aria-hidden="true">×</span>}
              <span className="formula__term">
                <span className="formula__value mono">{f.value}</span>
                <span className="formula__label">{f.label}</span>
              </span>
            </div>
          ))}
          <div className="formula__part">
            <span className="formula__op" aria-hidden="true">=</span>
            <span className="formula__term">
              <span className="formula__value mono">{formatBytes(perToken)}</span>
              <span className="formula__label">per token</span>
            </span>
          </div>
        </div>
      </div>

      <p>
        That sounds small, but it grows with the <Term>context length</Term> (how many tokens the conversation holds) and
        with the <Term>batch</Term> (how many people are served at once, each with their own cache). Try it:
      </p>

      <div className="card lesson-card">
        <div className="control-row" role="group" aria-label="Tokens in the conversation">
          <span className="control-row__label">Tokens</span>
          {contexts.map((n) => (
            <button key={n} type="button" className="btn btn--small" aria-pressed={n === context} onClick={() => setContext(n)}>
              {formatInt(n)}
            </button>
          ))}
        </div>
        <div className="control-row" role="group" aria-label="People at once">
          <span className="control-row__label">People at once</span>
          {USERS.map((n) => (
            <button key={n} type="button" className="btn btn--small" aria-pressed={n === users} onClick={() => setUsers(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="headline-number" aria-live="polite">
          <span className="mono">{formatBytes(total)}</span> of cache
        </p>
        <p className="muted small">
          {formatInt(context)} tokens × {formatBytes(perToken)}
          {facts.fixedStateBytes > 0 ? ` + ${formatBytes(facts.fixedStateBytes)} that this model always keeps` : ''}
          {users > 1 ? `, for each of ${users} people` : ''}.
          {facts.parameters ? ` For comparison, the model itself is ${formatBytes(facts.parameters * facts.bytesPerElement)}.` : ''}
        </p>
      </div>

      <p>
        So the question becomes: where do all these bytes go in memory, and how do you avoid wasting space? That’s
        what the different cache methods are about.
      </p>
    </Chapter>
  );
}
