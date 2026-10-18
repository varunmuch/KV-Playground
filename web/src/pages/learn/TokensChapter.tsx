import { useState } from 'react';
import { Term } from '../../components/Term';
import { TokenRow } from '../../components/TokenChip';
import { MODEL_NAME } from '../../qwen/model';
import { Chapter } from './Chapter';
import type { Lesson } from './useLesson';

export function TokensChapter({ lesson }: { lesson: Lesson }) {
  const [showIds, setShowIds] = useState(false);
  const special = lesson.promptA.filter((t) => t.special).length;

  return (
    <Chapter
      id="tokens"
      number={1}
      title="Text becomes tokens"
      summary="A model doesn’t read words. It reads tokens: small pieces of text, each with a number."
      terms={[
        ['Token', 'A small piece of text the model reads or writes, such as a word, part of a word, or a symbol.'],
        ['Tokenizer', 'The tool that splits text into tokens and gives each one its number.'],
        ['Vocabulary', 'Every token the model knows. Qwen3.5 has about 248,000.'],
        ['Special token', 'A marker that isn’t text, like the start of a message or whose turn it is.'],
        ['Prompt', 'Everything sent to the model before it answers.'],
      ]}
    >
      <p>
        Before a model can read anything, a <Term>tokenizer</Term> splits it into <Term>tokens</Term>. Each token has a
        number in the model’s <Term>vocabulary</Term>. Your question, split by {MODEL_NAME}’s real tokenizer, is{' '}
        {lesson.questionTokens.length} tokens:
      </p>

      <div className="card lesson-card">
        <TokenRow tokens={lesson.questionTokens} label={`Your question as ${lesson.questionTokens.length} tokens`} showIds={showIds} />
        <div className="lesson-card__footer">
          <button type="button" className="btn btn--small btn--secondary" aria-pressed={showIds} onClick={() => setShowIds(!showIds)}>
            {showIds ? 'Hide token numbers' : 'Show token numbers'}
          </button>
          <span className="muted small">· is a space. ↵ is a new line.</span>
        </div>
      </div>

      <ul className="plain-list">
        <li>Common short words are usually one token.</li>
        <li>Long or rare words are split into several pieces. Try typing a long, unusual word in your question.</li>
        <li>A space belongs to the word after it, so “ egg” and “egg” are different tokens.</li>
      </ul>

      <p>
        The app also adds the system prompt and a few <Term>special tokens</Term> (dashed below). They mark who is
        speaking: the system, the user or the assistant. This wrapping is called the <em>chat template</em>. Everything
        together is the <Term>prompt</Term>: <strong>{lesson.promptA.length} tokens</strong>, {special} of them special.
      </p>

      <div className="card lesson-card">
        <TokenRow tokens={lesson.promptA} label={`The full prompt, ${lesson.promptA.length} tokens`} showIds={showIds} />
      </div>
    </Chapter>
  );
}
