import styles from "./TopBar.module.css";

export function TopBar() {
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <a className={styles.wordmark} href="#assess">
          Pyometra&nbsp;Outcome
        </a>
        <a
          className="pill"
          href="https://github.com/bhattarya/canine-pyometra-ml"
          target="_blank"
          rel="noreferrer"
        >
          Source &amp; analysis
        </a>
      </div>
    </div>
  );
}
