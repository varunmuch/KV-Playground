/**
 * Example prompts for "Random prompt". Each has a system prompt and two questions, so the lesson can
 * show two visitors sharing the same system prompt. Visitors can edit any of them.
 */
interface ExamplePrompt {
  label: string;
  system: string;
  questions: [string, string];
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: 'Cooking helper',
    system: 'You are a friendly cooking assistant. Answer in one short sentence.',
    questions: ['How long should I boil an egg?', 'What can I use instead of butter when baking?'],
  },
  {
    label: 'Travel guide',
    system: 'You are a cheerful travel guide. Keep answers to two sentences.',
    questions: ['What should I pack for a weekend in the mountains?', 'How do I avoid jet lag on a long flight?'],
  },
  {
    label: 'Science teacher',
    system: 'You are a science teacher for curious ten-year-olds. Use simple words.',
    questions: ['Why is the sky blue?', 'How do plants drink water?'],
  },
  {
    label: 'Coding tutor',
    system: 'You are a patient programming tutor. Explain with one tiny example.',
    questions: ['What is a variable?', 'What does a for loop do?'],
  },
  {
    label: 'Fitness coach',
    system: 'You are an encouraging fitness coach. Give practical, safe advice in two sentences.',
    questions: ['How do I start running if I have never run before?', 'Is it better to stretch before or after exercise?'],
  },
  {
    label: 'Money basics',
    system: 'You explain personal finance to beginners in plain language, in two sentences.',
    questions: ['What is compound interest?', 'Why do people say to keep an emergency fund?'],
  },
  {
    label: 'Gardening',
    system: 'You are a gardening expert who gives short, practical tips.',
    questions: ['How often should I water tomato plants?', 'Which herbs grow well on a windowsill?'],
  },
  {
    label: 'History buff',
    system: 'You are a history enthusiast. Answer in two sentences with one interesting detail.',
    questions: ['Why were the pyramids built?', 'What was the printing press used for at first?'],
  },
  {
    label: 'Pet care',
    system: 'You are a calm, friendly vet assistant. Answer briefly and suggest a vet visit when needed.',
    questions: ['How often should I walk a young dog?', 'Why does my cat knead blankets?'],
  },
  {
    label: 'Writing coach',
    system: 'You are a writing coach. Give one concrete tip per answer.',
    questions: ['How do I start an essay when I am stuck?', 'How can I make my sentences shorter?'],
  },
  {
    label: 'Space explainer',
    system: 'You explain astronomy simply and accurately, in two sentences.',
    questions: ['Why does the Moon change shape?', 'How far away is the nearest star?'],
  },
  {
    label: 'Music teacher',
    system: 'You are a music teacher for adult beginners. Keep it short and encouraging.',
    questions: ['How long does it take to learn guitar chords?', 'What is the difference between rhythm and tempo?'],
  },
];

export function randomExample(exclude?: string): ExamplePrompt {
  const pool = EXAMPLE_PROMPTS.filter((p) => p.label !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** A long question, so a benchmark can compare short and long prompts. Original text written for this lab. */
export const LONG_QUESTION = `Summarize the following passage in two sentences.

Bread is one of the oldest prepared foods. The earliest evidence comes from charred crumbs found at a site in Jordan, made by hunter-gatherers about 14,000 years ago, thousands of years before farming began. Those first breads were flat: a paste of wild grains and roots, pressed thin and cooked on hot stones.

Raised bread came later and almost certainly by accident. Dough left out for a while collects wild yeasts and bacteria from the air and from the flour itself. They feed on the sugars in the grain and release carbon dioxide, which gets trapped in the stretchy gluten network and makes the dough rise. Bakers in ancient Egypt learned to keep a piece of yesterday's dough to start the next batch, the same idea as a sourdough starter today. They also built enclosed clay ovens, which bake far more evenly than an open fire.

For most of history, bread was the main source of calories for ordinary people, and its price was a political matter. Rulers fixed the size of a loaf, inspected bakers' scales, and punished cheats; in medieval England, bakers sometimes added a thirteenth loaf to every dozen to stay safely above the legal weight, which is where the phrase "a baker's dozen" comes from.

The biggest change arrived in the twentieth century. Commercial yeast, steel roller mills that produced very white flour, and fast industrial mixing made bread cheaper and softer than ever, and sliced bread appeared in shops in 1928. In recent decades many home bakers have returned to slower methods, long fermentation and whole-grain flours, for the deeper flavour and better texture they give.`;
