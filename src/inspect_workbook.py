"""Structural audit of the raw workbook.

Layout of every sheet: row 0 = sheet title (one cell), row 1 = blank,
row 2 = real header, rows 3+ = data. Column names carry mojibake
(e.g. 'TLCუuL' -> 'TLC_per_uL'). This loader is robust to the title/blank rows.
"""
import re
import pandas as pd
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw" / "canine_pyometra_80.xlsx"
pd.set_option("display.max_columns", 200)
pd.set_option("display.width", 240)
pd.set_option("display.max_rows", 300)


def clean_cols(cols):
    out = []
    for c in cols:
        c = str(c)
        c = c.replace("უ", "_per_").replace("µ", "u").replace("μ", "u")
        c = re.sub(r"[^0-9A-Za-z]+", "_", c).strip("_")
        out.append(c)
    return out


def load(sheet):
    raw = pd.read_excel(RAW, sheet_name=sheet, header=None)
    raw = raw.dropna(how="all").reset_index(drop=True)
    hdr = 0
    for i in range(min(6, len(raw))):
        if raw.iloc[i].notna().sum() > 1:
            hdr = i
            break
    df = raw.iloc[hdr + 1:].copy()
    df.columns = clean_cols(raw.iloc[hdr].tolist())
    df = df.dropna(how="all").reset_index(drop=True)
    for c in df.columns:                       # numeric coercion where clean
        conv = pd.to_numeric(df[c], errors="coerce")
        if conv.notna().sum() >= df[c].notna().sum() - 0:
            df[c] = conv
    return df


xl = pd.ExcelFile(RAW)
for name in ["Treatment_Protocols", "Outcome_Summary", "Data_Dictionary", "ML_Roadmap"]:
    print(f"\n===== {name} =====")
    print(load(name).to_string(index=False))

print("\n\n########## MODELLING SHEETS ##########")
base = load("80_Animal_Baseline")
out = load("Treatment_Outcomes")
print(f"\n[80_Animal_Baseline] shape={base.shape}")
print("cols:", list(base.columns))
print(base.describe().T.round(2).to_string())
print("\nGroup counts:\n", base["Group"].value_counts(dropna=False).to_string())
print("\nMissing:", base.isna().sum()[base.isna().sum() > 0].to_dict())

print(f"\n[Treatment_Outcomes] shape={out.shape}")
print("cols:", list(out.columns))
for c in out.columns:
    if out[c].nunique(dropna=True) <= 4:
        print(f"  {c}: {out[c].value_counts(dropna=False).to_dict()}")
print("  Days_to_Resolution:", out["Days_to_Resolution"].describe().round(2).to_dict())
print("  Missing:", out.isna().sum()[out.isna().sum() > 0].to_dict())

m = base.merge(out, on=["Animal_ID", "Group"], how="left", suffixes=("", "_o"))
print("\nGroup x Treatment_Success_D14:\n", pd.crosstab(m["Group"], m["Treatment_Success_D14"], margins=True).to_string())
print("\nGroup x Death:\n", pd.crosstab(m["Group"], m["Death"], margins=True).to_string())
print("\nGroup x Rescue_OHE:\n", pd.crosstab(m["Group"], m["Rescue_OHE"], margins=True).to_string())
print("\nGroup x Medical_Failure_D14:\n", pd.crosstab(m["Group"], m["Medical_Failure_D14"], margins=True).to_string())

for s in ["ML_Treatment_Prediction", "ML_Baseline_Risk_G1G3", "ML_missing_5pct"]:
    d = load(s)
    tgt = "Treatment_Success_D14" if "Treatment_Success_D14" in d.columns else "Medical_Failure_D14"
    print(f"\n[{s}] shape={d.shape} cols={list(d.columns)}")
    print(f"    target {tgt}: {d[tgt].value_counts(dropna=False).to_dict()}")
    if "Group" in d.columns:
        print(f"    Group: {d['Group'].value_counts(dropna=False).to_dict()}")
    mi = d.isna().sum()[d.isna().sum() > 0].to_dict()
    if mi:
        print(f"    missing: {mi}")

retro = load("Retro_6mo_240cases")
print(f"\n[Retro_6mo_240cases] shape={retro.shape} cols={list(retro.columns)}")
print(retro.head(8).to_string(index=False))
for c in retro.columns:
    if retro[c].dtype == object or retro[c].nunique(dropna=True) < 12:
        print(f"  {c}: {retro[c].value_counts(dropna=False).to_dict()}")

rep = load("Repeated_D0_D3_D7_D14")
print(f"\n[Repeated_D0_D3_D7_D14] shape={rep.shape} cols={list(rep.columns)}")
print("  Day counts:", rep["Day"].value_counts(dropna=False).to_dict())
print("  Missing:", rep.isna().sum()[rep.isna().sum() > 0].to_dict())
