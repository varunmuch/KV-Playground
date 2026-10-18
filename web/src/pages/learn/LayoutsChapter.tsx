import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { Term } from '../../components/Term';
import { MemoryLegend } from '../../components/MemoryLegend';
import { StepControls } from '../../components/StepControls';
import type { TokenPiece } from '../../data/types';
import type { Lesson } from './useLesson';
import { useStepper } from '../../hooks/useStepper';
import { lastStep, reusedPrefixTokens, simulate, stepPhase, type LayoutMethod, type MemoryState, type RequestId, type Scenario } from '../../simulator';
import { Chapter } from './Chapter';
import { layoutInfo } from './layoutInfo';
import { MemoryGrid } from './MemoryGrid';
import { MethodGuide } from './MethodGuide';
import { buildScenario, DEFAULT_SETTINGS, sequences as buildSequences, type SimSettings } from './scenario';

const METHODS: LayoutMethod[] = ['dynamic', 'static', 'paged', 'prefix'];
const METHOD_LABELS: Record<LayoutMethod, string> = { dynamic: 'Dynamic', static: 'Static', paged: 'Paged', prefix: 'Prefix sharing' };

function quote(token: TokenPiece | undefined): string {
  if (!token) return '';
  return token.placeholder ? 'its next word' : `“${token.text.trim() || token.text}”`;
}

function describeStep(method: LayoutMethod, scenario: Scenario, step: number, seqs: Record<RequestId, TokenPiece[]>): string {
  const phase = stepPhase(step);
  if (phase.kind === 'empty') return 'Step 0. Nothing has run yet. Memory is empty.';
  if (phase.kind === 'prefill' && phase.request === 'a') {
    return `Step 1 · You arrive. The model reads your ${scenario.promptTokensA}-token prompt and stores its keys and values.`;
  }
  if (phase.kind === 'prefill') {
    if (method === 'prefix') {
      const reused = reusedPrefixTokens(scenario);
      return `Step 2 · The second person arrives. Their first ${reused} tokens are already stored, so only ${scenario.promptTokensB - reused} new ones are computed.`;
    }
    return `Step 2 · The second person arrives. All ${scenario.promptTokensB} of their tokens are computed and stored, including the ${scenario.sharedPrefixTokens} that are the same as yours.`;
  }
  const a = seqs.a[scenario.promptTokensA + phase.index - 1];
  const b = seqs.b[scenario.promptTokensB + phase.index - 1];
  return `Step ${step} · Each answer grows by one token: you get ${quote(a)}, they get ${quote(b)}.`;
}

function gridLabel(state: MemoryState, method: LayoutMethod): string {
  const { metrics, lengths } = state;
  let text = `${state.slots.length} memory slots. Request A has ${lengths.a} tokens, request B has ${lengths.b}. ${metrics.slotsUsed} slots hold data, ${metrics.slotsAllocated} are allocated, ${metrics.wastedSlots} are reserved but empty.`;
  if (state.blockTables && method !== 'dynamic') {
    text += ` Block table A: ${state.blockTables.a.join(', ') || 'empty'}. Block table B: ${state.blockTables.b.join(', ') || 'empty'}.`;
  }
  return text;
}

const SETTING_OPTIONS: { key: keyof SimSettings; label: string; hint: string; values: number[]; format: (n: number) => string }[] = [
  { key: 'blockSize', label: 'Block size', hint: 'paged and prefix sharing', values: [2, 4, 8, 16], format: (n) => `${n} slots` },
  { key: 'answerTokens', label: 'Answer length', hint: 'all methods', values: [3, 6, 12, 0], format: (n) => (n ? `${n} tokens` : 'whole answer') },
  { key: 'reserveFactor', label: 'Static reserves', hint: 'static', values: [1, 2], format: (n) => (n === 1 ? 'just enough' : `${n}× more`) },
];

/** Knobs to play with: each one changes the scenario and the grid updates immediately. */
function SimSettingsControls({ settings, onChange }: { settings: SimSettings; onChange: (s: SimSettings) => void }) {
  return (
    <div className="sim-settings">
      <p className="sim-settings__title">Try changing</p>
      {SETTING_OPTIONS.map((option) => (
        <div key={option.key} className="control-row" role="group" aria-label={option.label}>
          <span className="control-row__label">
            {option.label} <span className="muted small">({option.hint})</span>
          </span>
          {option.values.map((v) => (
            <button key={v} type="button" className="btn btn--small" aria-pressed={settings[option.key] === v} onClick={() => onChange({ ...settings, [option.key]: v })}>
              {option.format(v)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LayoutsChapter({ lesson }: { lesson: Lesson }) {
  const [settings, setSettings] = useState<SimSettings>(DEFAULT_SETTINGS);
  const scenario = useMemo(() => buildScenario(lesson, settings), [lesson, settings]);
  const seqs = useMemo(() => buildSequences(lesson, scenario), [lesson, scenario]);
  // ?layout=paged&step=5 links straight to a moment in the simulation.
  const [params] = useSearchParams();
  const initialLayout = params.get('layout') as LayoutMethod | null;
  const [method, setMethod] = useState<LayoutMethod>(initialLayout && METHODS.includes(initialLayout) ? initialLayout : 'dynamic');
  const last = lastStep(scenario);
  const { step, setStep, playing, togglePlay } = useStepper(last, 900, Number(params.get('step')) || 0);
  const state = simulate(method, scenario, step);
  const info = layoutInfo(method, scenario);
  const paged = method === 'paged' || method === 'prefix';

  const metrics = [
    { label: 'Slots holding data', value: state.metrics.slotsUsed },
    { label: 'Slots allocated', value: state.metrics.slotsAllocated },
    { label: 'Wasted slots', value: state.metrics.wastedSlots },
    { label: 'Prefill tokens computed', value: state.metrics.prefillComputed },
    { label: 'Tokens copied', value: state.metrics.tokensCopied },
  ];

  return (
    <Chapter
      id="layouts"
      number={6}
      title="Four ways to store the cache"
      summary="Every method stores the same keys and values. They differ in where they put them, how much space is wasted, and what gets copied or shared."
      terms={[
        ['Allocation', 'Setting aside memory for a request.'],
        ['Fragmentation', 'Memory that is set aside but sits empty, so nobody can use it.'],
        ['Paging', 'Splitting memory into small fixed-size blocks handed out on demand (PagedAttention, used by vLLM).'],
        ['Block table', 'A per-request list of which blocks hold its tokens.'],
        ['Prefix caching', 'Reusing the cache for tokens two prompts start with, instead of computing them again.'],
      ]}
    >
      <p>
        Imagine two people using the same app at the same time. You (A) ask “{lesson.questionA}”. Someone else (B)
        asks “{lesson.questionB || lesson.questionA}”. Both prompts start with the same {scenario.sharedPrefixTokens} tokens:
        the system prompt and chat markers.
      </p>
      <p>
        Each square below is one slot of GPU memory, holding one token’s keys and values. The text inside is the token
        stored there. Setting memory aside for a request is called <Term>allocation</Term>. Memory that is set aside
        but sits empty is <Term>fragmentation</Term>: it’s wasted, because nobody else can use it.
      </p>
      <ul className="plain-list">
        <li><strong>Dynamic</strong> allocates exactly what’s used, but copies everything each time it grows.</li>
        <li><strong>Static</strong> allocates a fixed area up front: no copying, but lots of fragmentation.</li>
        <li>
          <strong>Paged</strong> uses <Term>paging</Term>: small blocks handed out when needed, tracked in a{' '}
          <Term>block table</Term>.
        </li>
        <li>
          <strong>Prefix sharing</strong> adds <Term>prefix caching</Term>: blocks that two prompts have in common are
          stored and computed once.
        </li>
      </ul>
      <p>Pick a method and press Play. Then change the settings and watch the waste change.</p>

      <div className="sim">
        <div className="sim__main card">
          <div className="figure-head">
            <div className="toggle-group" role="group" aria-label="Cache layout">
              {METHODS.map((m) => (
                <button key={m} type="button" className="btn btn--small" aria-pressed={m === method} onClick={() => setMethod(m)}>
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <Badge kind="simulated">Simulated · real tokens</Badge>
          </div>

          <SimSettingsControls settings={settings} onChange={setSettings} />

          <StepControls step={step} lastStep={last} playing={playing} onStep={setStep} onTogglePlay={togglePlay} label="Simulation steps" />
          <p className="step-label" aria-live="polite">
            {describeStep(method, scenario, step, seqs)}
          </p>

          <MemoryGrid state={state} sequences={seqs} blockSize={scenario.blockSize} paged={paged} label={gridLabel(state, method)} />

          {state.blockTables && paged && (
            <div className="block-tables mono">
              <p>
                <span className="block-tables__key block-tables__key--a" aria-hidden="true" />
                block table A → [{state.blockTables.a.join(', ')}]
              </p>
              <p>
                <span className="block-tables__key block-tables__key--b" aria-hidden="true" />
                block table B → [{state.blockTables.b.join(', ')}]
              </p>
            </div>
          )}

          <MemoryLegend kinds={method === 'prefix' ? ['shared', 'a', 'a-gen', 'b', 'b-gen', 'reserved', 'free'] : ['a', 'a-gen', 'b', 'b-gen', 'reserved', 'free']} />
        </div>

        <aside className="sim__side card" aria-label={`${info.name} details`}>
          <h3 className="sim__name">{info.name}</h3>
          <p className="sim__desc">{info.description}</p>
          <dl className="metric-grid">
            {metrics.map((m) => (
              <div key={m.label} className="metric">
                <dt className="metric__label">{m.label}</dt>
                <dd className="metric__value mono">{m.value}</dd>
              </div>
            ))}
          </dl>
          <div className="callout callout--compact">
            <p className="callout__title">What to notice</p>
            <p>{info.notice}</p>
          </div>
          <Link to="/benchmarks" className="btn btn--secondary sim__link">
            Measure it on the real model
          </Link>
        </aside>
      </div>
      <MethodGuide method={method} />
    </Chapter>
  );
}
