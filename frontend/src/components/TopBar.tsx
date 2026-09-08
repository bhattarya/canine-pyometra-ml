import styles from "./TopBar.module.css";
import { useTheme } from "../hooks/useTheme";

const GLYPH: Record<string, string> = { system: "◐", light: "☀", dark: "☾" };

export function TopBar() {
  const [theme, cycle] = useTheme();
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <span className={styles.wordmark}>
          <span className={styles.rx}>Rx</span> Pyometra&nbsp;/ medical-failure risk
        </span>
        <div className={styles.right}>
          <span className={styles.pill}>research preview</span>
          <button
            className={styles.theme}
            onClick={cycle}
            aria-label={`Theme: ${theme}. Click to change.`}
            title={`Theme: ${theme}`}
          >
            {GLYPH[theme]}
          </button>
        </div>
      </div>
    </div>
  );
}
