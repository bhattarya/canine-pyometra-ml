import styles from "./FeatureEffects.module.css";
import { FEATURE_EFFECTS, PROTOCOL_EFFECTS } from "../../data/findings";
import type { EffectRow } from "../../data/findings";

/**
 * Diverging bars for the standardised logistic-regression coefficients.
 * Right / --good = raises predicted success; left / --poor = lowers it.
 * Admission values and the protocol contrasts (vs G1) share one scale
 * so the bars are directly comparable (both are log-odds).
 */
const VB_W = 580;
const LBL_R = 188;
const AXIS_X = 368;
const HALF_W = 172;
const ROW_H = 22;
const TOP = 34;
const GAP = 26; // between the two groups

const MAX = Math.max(
  ...FEATURE_EFFECTS.map((r) => Math.abs(r.coef)),
  ...PROTOCOL_EFFECTS.map((r) => Math.abs(r.coef)),
);

const bx = (coef: number): number => AXIS_X + (coef / MAX) * HALF_W;

const groupBottom = TOP + FEATURE_EFFECTS.length * ROW_H;
const protoTop = groupBottom + GAP;
const H = protoTop + PROTOCOL_EFFECTS.length * ROW_H + 14;

function Bar({ row, yTop }: { row: EffectRow; yTop: number }) {
  const yMid = yTop + ROW_H / 2;
  const pos = row.coef >= 0;
  const end = bx(row.coef);
  const barX = pos ? AXIS_X : end;
  const barW = Math.abs(end - AXIS_X);
  const fill = pos ? "var(--good)" : "var(--poor)";
  // Wide bars carry the value inside (white) at the axis end; short bars
  // put it just past the far end so nothing collides with the labels.
  const inside = barW >= 30;
  const valueX = inside
    ? pos
      ? AXIS_X + 6
      : AXIS_X - 6
    : pos
      ? end + 6
      : end - 6;
  const label = `${row.coef > 0 ? "+" : ""}${row.coef.toFixed(2)}`;
  return (
    <g>
      <text x={LBL_R} y={yMid + 3.5} textAnchor="end" fontSize={11} fill="var(--ink)">
        {row.label}
      </text>
      <rect x={barX} y={yMid - 6} width={Math.max(1, barW)} height={12} rx={2} fill={fill} />
      <text
        x={valueX}
        y={yMid + 3.5}
        textAnchor={pos ? "start" : "end"}
        fontSize={10.5}
        fill={inside ? "var(--surface)" : "var(--ink-2)"}
        fontWeight={inside ? 600 : 400}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {label}
      </text>
    </g>
  );
}

export function FeatureEffects() {
  return (
    <div className={styles.scroll}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VB_W} ${H}`}
        role="img"
        aria-label="Standardised logistic-regression coefficients, by direction and size"
      >
        {/* direction legend */}
        <text x={AXIS_X - 8} y={16} textAnchor="end" fontSize={9.5} fill="var(--poor)">
          &larr; lowers predicted success
        </text>
        <text x={AXIS_X + 8} y={16} textAnchor="start" fontSize={9.5} fill="var(--good)">
          raises predicted success &rarr;
        </text>

        {/* zero axis */}
        <line
          x1={AXIS_X}
          x2={AXIS_X}
          y1={TOP - 8}
          y2={H - 8}
          stroke="var(--line-2)"
          strokeWidth={1}
        />

        {FEATURE_EFFECTS.map((r, i) => (
          <Bar key={r.label} row={r} yTop={TOP + i * ROW_H} />
        ))}

        {/* group divider */}
        <line
          x1={20}
          x2={VB_W - 20}
          y1={groupBottom + GAP / 2}
          y2={groupBottom + GAP / 2}
          stroke="var(--line)"
          strokeWidth={1}
        />
        <text
          x={LBL_R}
          y={groupBottom + GAP / 2 - 6}
          textAnchor="end"
          fontSize={9}
          fill="var(--ink-3)"
          letterSpacing="0.08em"
        >
          PROTOCOL vs G1
        </text>

        {PROTOCOL_EFFECTS.map((r, i) => (
          <Bar key={r.label} row={r} yTop={protoTop + i * ROW_H} />
        ))}
      </svg>
    </div>
  );
}
