import styles from "./StageReduction.module.css";
import { STAGE_REDUCTION } from "../../data/findings";

/**
 * CPV-style feature reduction for the treatment model: predictor count
 * collapses A -> B -> C while held-out ROC-AUC barely moves. Two small
 * paired panels per stage — one bar for the predictor count, one for
 * the AUC (with a +/- 1 SD whisker).
 */
const VB_W = 564;
const TOP = 34;
const ROW_H = 44;
const H = TOP + STAGE_REDUCTION.length * ROW_H + 20;

const LBL_R = 150;

const P1_L = 160;
const P1_R = 300;
const N_MAX = 20;

const P2_L = 366;
const P2_R = 512;
const A_LO = 0.8;
const A_HI = 1.0;

const nx = (n: number): number => P1_L + (n / N_MAX) * (P1_R - P1_L);
const ax = (v: number): number =>
  P2_L + ((clamp(v, A_LO, A_HI) - A_LO) / (A_HI - A_LO)) * (P2_R - P2_L);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

const A_TICKS = [0.8, 0.9, 1.0];

export function StageReduction() {
  return (
    <div className={styles.scroll}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VB_W} ${H}`}
        role="img"
        aria-label="Predictor count and ROC-AUC at each feature-reduction stage"
      >
        {/* panel headers */}
        <text x={P1_L} y={20} fontSize={10} fill="var(--ink-3)" letterSpacing="0.08em">
          PREDICTORS
        </text>
        <text x={P2_L} y={20} fontSize={10} fill="var(--ink-3)" letterSpacing="0.08em">
          ROC-AUC
        </text>

        {/* AUC gridlines */}
        {A_TICKS.map((t) => (
          <g key={t}>
            <line
              x1={ax(t)}
              x2={ax(t)}
              y1={TOP - 6}
              y2={TOP + STAGE_REDUCTION.length * ROW_H - 8}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={ax(t)}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fill="var(--ink-3)"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        {STAGE_REDUCTION.map((s, i) => {
          const yTop = TOP + i * ROW_H;
          const yMid = yTop + 14;
          return (
            <g key={s.key}>
              <text x={LBL_R} y={yMid - 4} textAnchor="end" fontSize={11} fill="var(--ink)">
                {s.label}
              </text>
              <text
                x={LBL_R}
                y={yMid + 9}
                textAnchor="end"
                fontSize={9.5}
                fill="var(--ink-3)"
              >
                stage {String.fromCharCode(65 + i)}
              </text>

              {/* predictor-count bar */}
              <rect
                x={P1_L}
                y={yMid - 6}
                width={Math.max(0, nx(s.nPredictors) - P1_L)}
                height={12}
                rx={2}
                fill="var(--surface-2)"
                stroke="var(--line-2)"
                strokeWidth={1}
              />
              <text
                x={nx(s.nPredictors) + 6}
                y={yMid + 3.5}
                fontSize={11}
                fill="var(--ink-2)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {s.nPredictors}
              </text>

              {/* AUC bar + whisker */}
              <rect
                x={P2_L}
                y={yMid - 6}
                width={Math.max(0, ax(s.auc.mean) - P2_L)}
                height={12}
                rx={2}
                fill="var(--accent)"
                stroke="var(--accent)"
                strokeWidth={1}
              />
              <line
                x1={ax(s.auc.mean - s.auc.sd)}
                x2={ax(s.auc.mean + s.auc.sd)}
                y1={yMid}
                y2={yMid}
                stroke="var(--ink-3)"
                strokeWidth={1}
              />
              <line
                x1={ax(s.auc.mean - s.auc.sd)}
                x2={ax(s.auc.mean - s.auc.sd)}
                y1={yMid - 3}
                y2={yMid + 3}
                stroke="var(--ink-3)"
                strokeWidth={1}
              />
              <line
                x1={ax(s.auc.mean + s.auc.sd)}
                x2={ax(s.auc.mean + s.auc.sd)}
                y1={yMid - 3}
                y2={yMid + 3}
                stroke="var(--ink-3)"
                strokeWidth={1}
              />
              <text
                x={P2_R + 8}
                y={yMid + 3.5}
                fontSize={11}
                fill="var(--ink-2)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {s.auc.mean.toFixed(3)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
