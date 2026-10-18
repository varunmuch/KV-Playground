import { Term } from '../../components/Term';
import { formatBytes } from '../../lib/format';
import type { ModelFacts } from '../../qwen/model';
import { Chapter } from './Chapter';

export function MoreTechniquesChapter({ facts }: { facts: ModelFacts }) {
  const perToken = facts.kvBytesPerToken;
  const linearLayers = facts.numLayers - facts.fullAttentionLayers;

  return (
    <Chapter
      id="more"
      number={7}
      title="More caching techniques"
      summary="The four layouts decide where the cache goes. These techniques make it smaller, move it, or keep only part of it."
      terms={[
        ['Quantization', 'Storing numbers with fewer bits. Smaller, but slightly less exact.'],
        ['Lossless vs. lossy', 'Lossless methods never change the answer; lossy ones can, a little.'],
        ['Offloading', 'Keeping part of the cache in normal computer memory instead of on the GPU.'],
        ['Sliding window', 'Keeping only the most recent tokens.'],
        ['Eviction', 'Throwing away the tokens judged least important, to save memory.'],
        ['Attention sink', 'The first few tokens, which models keep looking at. Eviction methods keep them.'],
      ]}
    >
      <p>
        Everything in chapter 6 is <Term>lossless</Term>: the model gets back exactly the keys and values it stored (apart
        from the tiny rounding differences you may have seen in the race). The techniques below trade a little accuracy, or
        speed, for memory. Some are <Term>lossy</Term>.
      </p>

      <div className="technique-list">
        <article className="card technique">
          <h3>Quantized cache</h3>
          <p>
            <Term>Quantization</Term> stores each number with fewer bits. Normally a key or value number takes 16 bits.
            Rounding it to 8 bits halves the cache; 4 bits quarters it. A small “scale” number per group of values remembers
            how to stretch them back.
          </p>
          <p className="technique__numbers mono small">
            This model, per token: 16-bit {formatBytes(perToken)} · 8-bit {formatBytes(perToken / 2)} · 4-bit {formatBytes(perToken / 4)}
          </p>
          <p className="small muted">
            <strong>Trade-off:</strong> lossy; answers can change slightly. <strong>Used in:</strong> vLLM’s 8-bit (FP8) KV
            cache, Hugging Face QuantizedCache.
          </p>
        </article>

        <article className="card technique">
          <h3>CPU offloading</h3>
          <p>
            <Term>Offloading</Term> keeps most of the cache in the computer’s normal memory (RAM), which is much larger than
            GPU memory. While the model works through its layers, each layer’s keys and values are copied onto the GPU just
            before they’re needed.
          </p>
          <p className="small muted">
            <strong>Trade-off:</strong> lossless, but every token waits for those copies, so it’s slower. Useful for very long
            contexts on small GPUs. <strong>Used in:</strong> Hugging Face OffloadedCache, LMCache, FlexGen.
          </p>
        </article>

        <article className="card technique">
          <h3>Sliding window</h3>
          <p>
            A <Term>sliding window</Term> keeps only the last few thousand tokens and drops older ones, so memory never grows
            past the window. Anything that slides out is forgotten.
          </p>
          <p className="small muted">
            <strong>Trade-off:</strong> the model must be trained to work this way, or its answers get worse. <strong>Used
            in:</strong> Mistral 7B (a 4,096-token window), and models that mix window layers with full-attention layers.
          </p>
        </article>

        <article className="card technique">
          <h3>Eviction</h3>
          <p>
            <Term>Eviction</Term> methods keep a fixed budget of tokens and throw away the ones that seem least useful. A
            surprising finding: models keep looking at the very first tokens, called <Term>attention sinks</Term>, so
            StreamingLLM keeps those plus the most recent tokens. H2O keeps the tokens that received the most attention so far.
          </p>
          <p className="small muted">
            <strong>Trade-off:</strong> lossy, and the model can lose a detail it needs later. Mostly used in research and very
            long-running chats.
          </p>
        </article>

        {linearLayers > 0 && (
          <article className="card technique">
            <h3>Fixed-size memory layers</h3>
            <p>
              Some newer models, including this one, change the model itself. Only {facts.fullAttentionLayers} of{' '}
              {facts.numLayers} layers keep a normal KV cache. The other {linearLayers} use “linear attention”: they squeeze
              everything so far into one summary that never grows ({formatBytes(facts.fixedStateBytes)} in total here), the
              same size for 10 tokens or 100,000.
            </p>
            <p className="small muted">
              <strong>Trade-off:</strong> a summary can’t recall exact details as well, so the model keeps a few full-attention
              layers for that. <strong>Used in:</strong> Qwen3.5 and Qwen3-Next, and many other recent models.
            </p>
          </article>
        )}
      </div>

      <p className="muted small">
        The Benchmarks page measures no cache, the dynamic and static caches, and prefix sharing. Paged memory appears in the
        simulator only, and the techniques in this chapter aren’t measured.
      </p>
    </Chapter>
  );
}
