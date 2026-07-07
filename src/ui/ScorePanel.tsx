import { FACTOR_KEYS, FactorKey, GenResult } from '../model/types';

type Weights = Record<FactorKey, number>;
import { FACTOR_LABEL } from '../scoring/score';

interface Props {
  result: GenResult;
  weights: Weights;
}

export function ScorePanel({ result, weights }: Props) {
  const { score } = result;
  const total = Math.round(score.total);
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="scorepanel">
      <div className="score-total" role="img" aria-label={`Balance-Score ${total} von 100`}>
        <svg viewBox="0 0 84 84" width="84" height="84">
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--ring-bg)" strokeWidth="8" />
          <circle
            cx="42" cy="42" r={R} fill="none"
            stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(C * total) / 100} ${C}`}
            transform="rotate(-90 42 42)"
          />
          <text x="42" y="42" textAnchor="middle" dominantBaseline="central" className="score-num">
            {total}
          </text>
        </svg>
        <div className="score-meta">
          <strong>Balance-Score</strong>
          <span>
            {result.tried} Kandidaten · {result.ms} ms
            {result.failed > 0 ? ` · ${result.failed} verworfen` : ''}
          </span>
        </div>
      </div>

      <div className="factors">
        {FACTOR_KEYS.map((k) => {
          const v = score.factors[k];
          const w = weights[k];
          return (
            <div key={k} className={`factor${w === 0 ? ' muted' : ''}`}>
              <span className="factor-label">
                {FACTOR_LABEL[k]}
                <em>×{w.toFixed(1)}</em>
              </span>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${Math.round(v * 100)}%` }} />
              </div>
              <span className="factor-val">{Math.round(v * 100)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
