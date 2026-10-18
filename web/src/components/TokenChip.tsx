import type { TokenPiece } from '../data/types';

/** Make invisible characters visible: a leading space becomes ·, a newline becomes ↵. */
function displayToken(text: string): string {
  return text.replace(/\n/g, '↵').replace(/ /g, '·') || '∅';
}

/** Text for a token chip or slot. A placeholder (answer not generated) shows as “?”. */
export function tokenLabel(token: TokenPiece): string {
  return token.placeholder ? '?' : displayToken(token.text);
}

type ChipTone = 'plain' | 'special' | 'a' | 'a-gen' | 'b' | 'b-gen' | 'shared' | 'computed' | 'cached' | 'faded';

interface TokenChipProps {
  token: TokenPiece;
  tone?: ChipTone;
  showId?: boolean;
  highlight?: boolean;
}

export function TokenChip({ token, tone, showId = false, highlight = false }: TokenChipProps) {
  const resolved = tone ?? (token.special ? 'special' : 'plain');
  const classes = ['chip', `chip--${resolved}`, highlight && 'chip--highlight', token.placeholder && 'chip--placeholder'].filter(Boolean).join(' ');
  return (
    <span className={classes} title={token.placeholder ? 'Not generated: start the model server to see the real word' : `Token number ${token.id}`}>
      <span className="chip__text mono">{tokenLabel(token)}</span>
      {showId && !token.placeholder && <span className="chip__id mono">{token.id}</span>}
    </span>
  );
}

interface TokenRowProps {
  tokens: TokenPiece[];
  label: string;
  showIds?: boolean;
  toneFor?: (token: TokenPiece, index: number) => ChipTone | undefined;
  highlightIndex?: number;
}

/** A wrapping row of token chips. */
export function TokenRow({ tokens, label, showIds, toneFor, highlightIndex }: TokenRowProps) {
  return (
    <div className="token-row" role="group" aria-label={label}>
      {tokens.map((token, i) => (
        <TokenChip key={i} token={token} showId={showIds} tone={toneFor?.(token, i)} highlight={i === highlightIndex} />
      ))}
    </div>
  );
}
