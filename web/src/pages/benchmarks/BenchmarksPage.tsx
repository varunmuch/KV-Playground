import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { WordsToKnow } from '../../components/Term';
import type { BenchmarkResult } from '../../live/api';
import { BenchmarkForm } from './BenchmarkForm';
import { BenchmarkResults } from './BenchmarkResults';

const TERMS: [string, string][] = [
  ['Time to first token (TTFT)', 'How long until the answer starts. Mostly prefill: the model reading your prompt.'],
  ['Time per output token', 'How long each token after the first takes. This is where the KV cache helps most.'],
  ['Median and p95', 'Each test runs more than once. The median is the typical time; p95 is the slow end (95% of runs are faster).'],
  ['Warm-up', 'An untimed first run, so one-off start-up costs don’t count against any method.'],
  ['Baseline', '“No cache” is the reference: every other method’s answer is compared with it.'],
  ['Greedy decoding', 'The model always picks its single most likely next token, so runs are repeatable.'],
];

export function BenchmarksPage() {
  const [run, setRun] = useState<{ result: BenchmarkResult; questions: string[]; system: string } | null>(null);

  return (
    <div className="container">
      <PageHeader eyebrow="Measure it" title="Benchmarks">
        You’ve seen how a KV cache works in the <Link to="/">lesson</Link>. Now time it on the real model: pick some prompts,
        press Run, and compare.
      </PageHeader>

      <WordsToKnow terms={TERMS} />

      <BenchmarkForm onResult={(result, questions, system) => setRun({ result, questions, system })} />
      {run && <BenchmarkResults result={run.result} questions={run.questions} system={run.system} />}
    </div>
  );
}
