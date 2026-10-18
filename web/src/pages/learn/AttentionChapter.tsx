import { Term } from '../../components/Term';
import { tokenLabel } from '../../components/TokenChip';
import type { TokenPiece } from '../../data/types';
import type { ModelFacts } from '../../qwen/model';
import { Chapter } from './Chapter';
import type { Lesson } from './useLesson';

/** The newest token compares against every earlier token's key. No attention weights are shown: we don't have real ones. */
function LookBackDiagram({ tokens, newest }: { tokens: TokenPiece[]; newest: TokenPiece }) {
  const cell = 76;
  const width = (tokens.length + 1) * cell;
  const newestX = tokens.length * cell + cell / 2;
  return (
    <div className="qkv-scroll">
      <svg className="qkv" viewBox={`0 0 ${width} 176`} width={width} height={176} role="img"
        aria-label={`The newest token looks back at the key and value of each of the ${tokens.length} tokens before it.`}>
        {tokens.map((_, i) => {
          const x = i * cell + cell / 2;
          return <path key={i} d={`M ${newestX} 112 C ${newestX} 60, ${x} 60, ${x} 112`} className="qkv__link" />;
        })}
        {[...tokens, newest].map((token, i) => {
          const x = i * cell + 6;
          const isNew = i === tokens.length;
          const w = cell - 12;
          return (
            <g key={i}>
              <rect x={x} y={10} width={w} height={30} rx={6} className={isNew ? 'qkv__tok qkv__tok--new' : 'qkv__tok'} />
              <text x={x + w / 2} y={30} className="qkv__text" textAnchor="middle">{tokenLabel(token)}</text>
              {!isNew && (
                <>
                  <rect x={x} y={112} width={(w - 4) / 2} height={22} rx={4} className="qkv__k" />
                  <text x={x + (w - 4) / 4} y={127} className="qkv__label qkv__label--light" textAnchor="middle">K</text>
                  <rect x={x + (w - 4) / 2 + 4} y={112} width={(w - 4) / 2} height={22} rx={4} className="qkv__v" />
                  <text x={x + (w - 4) / 2 + 4 + (w - 4) / 4} y={127} className="qkv__label" textAnchor="middle">V</text>
                </>
              )}
              {isNew && <text x={x + w / 2} y={128} className="qkv__label" textAnchor="middle">new</text>}
            </g>
          );
        })}
        <text x={8} y={166} className="qkv__caption">K = key, V = value. The new token checks every key, then uses the values that match.</text>
      </svg>
    </div>
  );
}

export function AttentionChapter({ lesson, facts }: { lesson: Lesson; facts: ModelFacts }) {
  const words = lesson.promptA.filter((t) => !t.special && t.text.trim()).slice(-6);

  return (
    <Chapter
      id="attention"
      number={3}
      title="What the model remembers: keys and values"
      summary="For every token, the model makes two small lists of numbers, a key and a value. New tokens use them to look back at everything before."
      terms={[
        ['Attention', 'The step where a token looks back at earlier tokens and gathers what it needs from them.'],
        ['Query (Q)', 'What the current token is looking for.'],
        ['Key (K)', 'What an earlier token is about: its label.'],
        ['Value (V)', 'The information an earlier token passes on when it matches.'],
        ['Layer', 'One of the model’s stacked processing stages. Each attention layer has its own keys and values.'],
      ]}
    >
      <p>
        The look-back step is called <Term>attention</Term>. Think of every token leaving a labelled note behind:
      </p>
      <ul className="plain-list">
        <li>
          The <Term>key</Term> (K) is the label on the note: what this token is about.
        </li>
        <li>
          The <Term>value</Term> (V) is what’s written inside: the information it carries.
        </li>
        <li>
          The new token brings a <Term>query</Term> (Q): what it’s looking for.
        </li>
      </ul>
      <p>
        The model compares the query with every earlier key, then mixes together the values that match best. Keys,
        values and queries are just lists of numbers, worked out from each token.
      </p>

      <div className="card lesson-card">
        <LookBackDiagram tokens={words} newest={lesson.answerA[0]} />
      </div>

      <div className="callout">
        <p className="callout__title">Why keys and values can be saved</p>
        <p>
          A token’s key and value depend only on that token and the ones before it. The model never looks ahead. So once
          they’re computed, they never change, and computing them again gives exactly the same numbers. That’s wasted
          work, and the next chapter shows how to avoid it. Queries don’t need saving: only the newest token’s query is
          ever used.
        </p>
      </div>

      <p className="muted small">
        In this model: keys and values are made in {facts.fullAttentionLayers} attention <Term>layers</Term>, with{' '}
        {facts.numKvHeads} sets per token in each layer and {facts.headDim} numbers per set. Several query “heads” share
        each set of keys and values, a trick called grouped-query attention that keeps the cache small.
      </p>
    </Chapter>
  );
}
