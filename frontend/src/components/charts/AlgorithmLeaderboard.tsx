import styles from "./AlgorithmLeaderboard.module.css";
import { LEADERBOARD, LEADERBOARD_DOMAIN } from "../../data/findings";

/**
 * Horizontal ROC-AUC bars for the class_weight leaderboard, sorted desc.
 * Bars from the deployed logistic-regression family are filled --accent;
 * the rest are muted. A whisker shows +/- 1 SD (clamped to the domain).
 */
const [D_LO, D_HI] = LEADERBOARD_DOMAIN;

const PLOT_L = 158;
const PLOT_R = 470;
const PLOT_W = PLOT_R - PLOT_L;
const ROW_H = 24;
const TOP = 12;
const BOT_AXIS = 26;
const H = TOP + LEADERBOARD.length * ROW_H + BOT_AXIS;
const VB_W = 520;

const TICKS = [0.75, 0.8, 0.85, 0.9, 0.95, 1.0];

const x = (v: number): number =>
  PLOT_L + ((clamp(v, D_LO, D_HI) - D_LO) / (D_HI - D_LO)) * PLOT_W;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function AlgorithmLeaderboard() {
  return (
    <div className={styles.scroll}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VB_W} ${H}`}
        role="img"
        aria-label="ROC-AUC by algorithm, class-weighted, sorted descending"
      >
        {/* gridlines + x-axis ticks */}
        {TICKS.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={TOP - 4}
              y2={TOP + LEADERBOARD.length * ROW_H}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={x(t)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--ink-3)"
            >
              {t.toFixed(2)}
            </text>
          </g>
        ))}

        {LEADERBOARD.map((row, i) => {
          const yMid = TOP + i * ROW_H + ROW_H / 2;
          const barY = yMid - 6;
          const w = x(row.mean) - PLOT_L;
          const wLo = x(row.mean - row.sd);
          const wHi = x(row.mean + row.sd);
          return (
            <g key={row.key}>
              <text
                x={PLOT_L - 10}
                y={yMid + 3.5}
                textAnchor="end"
                fontSize={11}
                fill="var(--ink)"
                fontWeight={row.deployed ? 700 : 400}
              >
                {row.model}
              </text>

              <rect
                x={PLOT_L}
                y={barY}
                width={Math.max(0, w)}
                height={12}
                rx={2}
                fill={row.deployed ? "var(--accent)" : "var(--surface-2)"}
                stroke={row.deployed ? "var(--accent)" : "var(--line)"}
                strokeWidth={1}
              />

              {/* +/- 1 SD whisker */}
              <line
                x1={wLo}
                x2={wHi}
                y1={yMid}
                y2={yMid}
                stroke="var(--ink-3)"
                strokeWidth={1}
              />
              <line
                x1={wLo}
                x2={wLo}
                y1={yMid - 3}
                y2={yMid + 3}
                stroke="var(--ink-3)"
                strokeWidth={1}
              />
              <line
                x1={wHi}
                x2={wHi}
                y1={yMid - 3}
                y2={yMid + 3}
                stroke="var(--ink-3)"
                strokeWidth={1}
              />

              <text
                x={PLOT_R + 8}
                y={yMid + 3.5}
                fontSize={11}
                fill="var(--ink-2)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {row.mean.toFixed(3)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
