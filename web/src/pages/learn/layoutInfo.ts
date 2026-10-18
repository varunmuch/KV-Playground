import type { LayoutMethod, Scenario } from '../../simulator';
import { reusedPrefixTokens } from '../../simulator';

interface LayoutInfo {
  name: string;
  description: string;
  notice: string;
}

export function layoutInfo(method: LayoutMethod, scenario: Scenario): LayoutInfo {
  switch (method) {
    case 'dynamic':
      return {
        name: 'Dynamic',
        description:
          'Each person gets one continuous strip of memory. To add a token, a slightly bigger strip is made and everything is copied into it.',
        notice: 'No space is wasted. But look at “Tokens copied”: it grows at every step, because the whole cache is copied each time.',
      };
    case 'static':
      return {
        name: 'Static',
        description: `Each person reserves a fixed area of ${scenario.staticReservePerRequest} slots the moment they start. Tokens fill it in place, so nothing is ever copied.`,
        notice: 'The dashed slots are reserved but empty. Nobody else can use them. Real servers often reserve thousands of slots per person.',
      };
    case 'paged':
      return {
        name: 'Paged',
        description: `Memory is cut into small blocks of ${scenario.blockSize} slots. A person gets a new block only when their last one is full. A short list, the block table, remembers which blocks are theirs.`,
        notice: `Blocks from both people mix together, and that’s fine. At most ${scenario.blockSize - 1} slots per person sit empty, and nothing is copied.`,
      };
    case 'prefix': {
      const reused = reusedPrefixTokens(scenario);
      const leftover = scenario.sharedPrefixTokens - reused;
      return {
        name: 'Prefix sharing',
        description: `Like paged, plus sharing. Both prompts start with the same ${scenario.sharedPrefixTokens} tokens. The second person’s block table points at blocks the first person already filled, so those tokens are stored and computed only once.`,
        notice:
          `B skips ${reused} tokens: no computing, no extra memory.` +
          (leftover > 0
            ? ` Only full blocks can be shared, so the last ${leftover} shared token${leftover > 1 ? 's are' : ' is'} computed again by B.`
            : ''),
      };
    }
  }
}
