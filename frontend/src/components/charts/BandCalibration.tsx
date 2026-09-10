import styles from "./BandCalibration.module.css";
import { BAND_CALIBRATION } from "../../data/findings";

/**
 * How the three predicted bands played out in the cohort: one column
 * per band, height = observed day-14 success rate, coloured by tone.
 */
const VB_W = 380;
const VB_H = 250;
const BASE_Y = 200;
const PLOT_H = 170;
const PLOT_L = 60;
const PLOT_R = 344;
const PLOT_W = PLOT_R - PLOT_L;
const BAR_W = 66;

const TONE: Record<string, { fill: string; wash: string }> = {
  poor: { fill: "var(--poor)", wash: "var(--poor-wash)" },
  warn: { fill: "var(--warn)", wash: "var(--warn-wash)" },
  good: { fill: "var(--good)", wash: "var(--good-wash)" },
};

const fmtPct = (r: number): string =>
  `${(r * 100).toFixed(Number.isInteger(r * 100) ? 0 : 1)}%`;

const Y_TICKS = [0, 0.5, 1];

export function BandCalibration() {
  return (
    <div className={styles.scroll}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="Observed success rate within each predicted band"
      >
        {/* y-axis gridlines */}
        {Y_TICKS.map((t) => {
          const y = BASE_Y - t * PLOT_H;
          return (
            <g key={t}>
              <line
                x1={PLOT_L - 8}
                x2={PLOT_R + 8}
                y1={y}
                y2={y}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={PLOT_L - 14}
                y={y + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--ink-3)"
              >
                {t * 100}%
              </text>
            </g>
          );
        })}

        {BAND_CALIBRATION.map((b, i) => {
          const cx = PLOT_L + ((i + 0.5) * PLOT_W) / BAND_CALIBRATION.length;
          const barX = cx - BAR_W / 2;
          const barH = b.observedSuccessRate * PLOT_H;
          const barY = BASE_Y - barH;
          const tone = TONE[b.tone];
          return (
            <g key={b.band}>
              {/* full-height track */}
              <rect
                x={barX}
                y={BASE_Y - PLOT_H}
                width={BAR_W}
                height={PLOT_H}
                rx={3}
                fill={tone.wash}
              />
              <rect
                x={barX}
                y={barY}
                width={BAR_W}
                height={barH}
                rx={3}
                fill={tone.fill}
              />
              <text
                x={cx}
                y={barY - 8}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill="var(--ink)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmtPct(b.observedSuccessRate)}
              </text>
              <text
                x={cx}
                y={BASE_Y + 18}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="var(--ink)"
              >
                {b.band}
              </text>
              <text
                x={cx}
                y={BASE_Y + 33}
                textAnchor="middle"
                fontSize={10}
                fill="var(--ink-3)"
              >
                n = {b.n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
