import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { EXAMPLE_PROMPTS } from '../../content/examplePrompts';
import { useLive } from '../../live/LiveContext';
import { MODEL_NAME } from '../../qwen/model';
import { useModelFacts, useQwenTokenizer } from '../../qwen/QwenContext';
import { AttentionChapter } from './AttentionChapter';
import { CacheChapter } from './CacheChapter';
import { GenerationChapter } from './GenerationChapter';
import { LayoutsChapter } from './LayoutsChapter';
import { LessonPromptPanel } from './LessonPromptPanel';
import { MemoryChapter } from './MemoryChapter';
import { MoreTechniquesChapter } from './MoreTechniquesChapter';
import { TokensChapter } from './TokensChapter';
import { useLesson, type LessonInput } from './useLesson';

const CHAPTERS = [
  ['tokens', 'Text becomes tokens'],
  ['generation', 'One token at a time'],
  ['attention', 'Keys and values'],
  ['cache', 'Without vs. with a cache'],
  ['memory', 'The cost: memory'],
  ['layouts', 'Four ways to store it'],
  ['more', 'More techniques'],
];

const first = EXAMPLE_PROMPTS[0];

export function LearnPage() {
  const [input, setInput] = useState<LessonInput>({ system: first.system, questionA: first.questions[0], questionB: first.questions[1] });
  const live = useLive();
  const facts = useModelFacts();
  const { state: tokenizer, progress } = useQwenTokenizer();
  // Typing updates the text boxes at once; the six chapters catch up in the background.
  const lessonInput = useDeferredValue(input);
  const { lesson, answerState } = useLesson(lessonInput, tokenizer.status === 'ready' ? tokenizer.data : null, live !== null);

  return (
    <div className="container">
      <PageHeader eyebrow="A KV cache playground" title="See where every key and value lives.">
        Follow your own prompt through a real model ({MODEL_NAME}): how it becomes tokens, how the answer is written one
        token at a time, and why a KV cache makes that so much faster. No background needed. When you’re done, measure it
        on the <Link to="/benchmarks">Benchmarks</Link> page.
      </PageHeader>

      <LessonPromptPanel
        value={input}
        onChange={setInput}
        serverOnline={live !== null}
        tokenizerStatus={tokenizer.status}
        progress={progress}
        answerState={answerState}
        promptTokens={lesson?.promptA.length ?? null}
        answer={lesson?.answersReal ? { text: lesson.answerA.map((t) => t.text).join(''), tokens: lesson.answerA.length } : null}
      />

      <nav className="toc" aria-label="Chapters">
        <ol>
          {CHAPTERS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ol>
      </nav>

      {facts.status === 'error' && <p className="field__error">Could not load the model’s config from Hugging Face: {facts.message}</p>}
      {lesson && facts.status === 'ready' && (
        <>
          <TokensChapter lesson={lesson} />
          <GenerationChapter lesson={lesson} />
          <AttentionChapter lesson={lesson} facts={facts.data} />
          <CacheChapter lesson={lesson} />
          <MemoryChapter facts={facts.data} />
          <LayoutsChapter lesson={lesson} />
          <MoreTechniquesChapter facts={facts.data} />
        </>
      )}
    </div>
  );
}
