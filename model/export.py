"""Rebuilds the experimental cash-flow model from the course notebook
(Berka_Cashflow_PD_Colab.ipynb) and exports it for the backend.

It uses the notebook's data, features, split and pipeline, and keeps the model
the notebook picks by cross-validation ("B: Cash flow only", logistic
regression). It stops if its results differ from the ones the notebook printed,
so the exported numbers are the notebook's model.

Writes:
  backend/config/experimental-model.json  imputer medians, scaler, coefficients,
                                          training facts and test results
  backend/src/experimental.parity.json    invented statements with the features
                                          and scores this pipeline gives them, so
                                          the TypeScript port can be tested

Run from the repo root (needs pandas, numpy and scikit-learn):
  .venv/bin/python model/export.py
The Berka tables (about 70 MB) are downloaded to model/.data/ on first run.
"""

import json
import math
import platform
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'model' / '.data'
MODEL_OUT = ROOT / 'backend' / 'config' / 'experimental-model.json'
PARITY_OUT = ROOT / 'backend' / 'src' / 'experimental.parity.json'
DATA_URL = 'https://raw.githubusercontent.com/jlacko/berka-dataset/master/'
RANDOM_STATE = 42
MIN_TX = 5
WINDOW_DAYS = 180

# What the notebook printed (cells 14, 16, 18 and 20), at the precision printed.
NOTEBOOK = {
    'cv_roc_auc': (0.8433, 4),
    'test_roc_auc': (0.757, 3),
    'test_pr_auc': (0.418, 3),
    'test_brier': (0.177, 3),
    'boot_low': (0.581, 3),
    'boot_high': (0.912, 3),
    'example_score': (0.5231, 4),
}

FEATURE_NAMES = [
    'tx_count_180d', 'history_days_180d', 'observed_months_180d',
    'total_inflow_180d', 'total_outflow_180d', 'net_flow_180d',
    'avg_monthly_inflow_180d', 'avg_monthly_outflow_180d', 'avg_monthly_net_180d',
    'std_monthly_net_180d', 'income_cv_180d', 'inflow_months_180d',
    'median_tx_balance_180d', 'min_tx_balance_180d',
    'median_daily_observed_balance_90d', 'recent_large_inflow_share_30d',
    'negative_balance_tx_share_180d', 'median_inflow_size_180d',
]


def parse_berka_date(series):
    z = pd.to_numeric(series, errors='coerce').astype('Int64').astype('string').str.zfill(6)
    return pd.to_datetime('19' + z, format='%Y%m%d', errors='coerce')


# The notebook's feature builder. Training keeps the notebook's default sort,
# which can reorder transactions on the same day; that is needed to reproduce its
# model exactly. With stable=True, same-day transactions keep their file order,
# so a day's last balance is the one after its last transaction. That is what
# the backend does, so the parity statements use it.
def cashflow_features(tx, as_of_date, window_days=WINDOW_DAYS, stable=False):
    as_of_date = pd.Timestamp(as_of_date)
    t = tx.loc[(tx['tx_date'] >= as_of_date - pd.Timedelta(days=window_days)) &
               (tx['tx_date'] < as_of_date)].copy()
    out = {k: np.nan for k in FEATURE_NAMES}
    out['tx_count_180d'] = len(t)
    if t.empty:
        out.update({'history_days_180d': 0, 'observed_months_180d': 0, 'inflow_months_180d': 0})
        return out
    t = t.sort_values('tx_date', kind='stable') if stable else t.sort_values('tx_date')
    out['history_days_180d'] = int((t['tx_date'].max() - t['tx_date'].min()).days + 1)
    inflow = t.loc[t['is_inflow']]
    outflow = t.loc[t['is_outflow']]
    received = float(inflow['amount'].sum())
    paid = float(outflow['amount'].sum())
    out['total_inflow_180d'] = received
    out['total_outflow_180d'] = paid
    out['net_flow_180d'] = received - paid
    day_age = (as_of_date - t['tx_date']).dt.days
    t['bin30'] = np.minimum((day_age - 1) // 30, 5)
    monthly = pd.DataFrame({'inflow': np.zeros(6), 'outflow': np.zeros(6)})
    for flag, col in [('is_inflow', 'inflow'), ('is_outflow', 'outflow')]:
        monthly[col] = t.loc[t[flag]].groupby('bin30')['amount'].sum().reindex(range(6), fill_value=0).to_numpy()
    net = monthly['inflow'] - monthly['outflow']
    out['observed_months_180d'] = int(t['bin30'].nunique())
    out['inflow_months_180d'] = int((monthly['inflow'] > 0).sum())
    out['avg_monthly_inflow_180d'] = float(monthly['inflow'].mean())
    out['avg_monthly_outflow_180d'] = float(monthly['outflow'].mean())
    out['avg_monthly_net_180d'] = float(net.mean())
    out['std_monthly_net_180d'] = float(net.std(ddof=0))
    out['income_cv_180d'] = float(monthly['inflow'].std(ddof=0) / (monthly['inflow'].mean() + 1))
    out['median_tx_balance_180d'] = float(t['balance'].median())
    out['min_tx_balance_180d'] = float(t['balance'].min())
    t90 = t.loc[t['tx_date'] >= as_of_date - pd.Timedelta(days=90)]
    daily_end = t90.groupby('tx_date')['balance'].last()
    out['median_daily_observed_balance_90d'] = float(daily_end.median()) if not daily_end.empty else np.nan
    out['negative_balance_tx_share_180d'] = float((t['balance'] < 0).mean())
    out['median_inflow_size_180d'] = float(inflow['amount'].median()) if len(inflow) else np.nan
    recent_inflow = inflow.loc[inflow['tx_date'] >= as_of_date - pd.Timedelta(days=30), 'amount']
    benchmark = inflow['amount'].median() if len(inflow) else np.nan
    large = recent_inflow.loc[recent_inflow > 3 * benchmark] if pd.notna(benchmark) else pd.Series(dtype=float)
    out['recent_large_inflow_share_30d'] = float(large.sum() / (recent_inflow.sum() + 1))
    return out


def load_tables():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name in ['loan.asc', 'trans.asc']:
        path = DATA_DIR / name
        if not path.exists():
            print(f'Downloading {name}')
            urllib.request.urlretrieve(DATA_URL + name, path)
    loans = pd.read_csv(DATA_DIR / 'loan.asc', sep=';', low_memory=False)
    trans = pd.read_csv(DATA_DIR / 'trans.asc', sep=';', low_memory=False)
    loans['loan_date'] = parse_berka_date(loans['date'])
    trans['tx_date'] = parse_berka_date(trans['date'])
    trans['amount'] = pd.to_numeric(trans['amount'], errors='coerce')
    trans['balance'] = pd.to_numeric(trans['balance'], errors='coerce')
    trans['is_inflow'] = trans['type'].eq('PRIJEM')
    trans['is_outflow'] = trans['type'].isin(['VYDAJ', 'VYBER'])
    trans = trans.sort_values(['account_id', 'tx_date', 'trans_id']).copy()
    return loans, trans


def logistic_pipeline():
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median', add_indicator=False)),
        ('scaler', RobustScaler()),
        ('classifier', LogisticRegression(max_iter=2000, class_weight='balanced', random_state=RANDOM_STATE)),
    ])


def check(name, value):
    expected, digits = NOTEBOOK[name]
    got = round(float(value), digits)
    status = 'ok' if got == expected else 'MISMATCH'
    print(f'  {name}: {got} (notebook {expected}) {status}')
    return got == expected


def main():
    loans, trans = load_tables()
    eligible = loans.loc[loans['status'].isin({'A': 0, 'B': 1})].copy()
    eligible['DEFAULT'] = eligible['status'].map({'A': 0, 'B': 1}).astype(int)
    groups = {aid: g for aid, g in trans.groupby('account_id', sort=False)}
    rows = []
    for r in eligible.itertuples(index=False):
        t = groups.get(r.account_id, trans.iloc[:0])
        rows.append({'loan_id': r.loan_id, 'account_id': r.account_id, 'loan_date': r.loan_date,
                     'DEFAULT': int(r.DEFAULT), **cashflow_features(t, r.loan_date)})
    model_df = pd.DataFrame(rows).sort_values('loan_date').reset_index(drop=True)
    analysis_df = model_df.loc[model_df['tx_count_180d'] >= MIN_TX].copy()

    y = analysis_df['DEFAULT']
    x = analysis_df[FEATURE_NAMES]
    train_idx, test_idx = train_test_split(np.arange(len(analysis_df)), test_size=0.25, stratify=y,
                                           random_state=RANDOM_STATE)
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
    cv_scores = cross_validate(logistic_pipeline(), x.iloc[train_idx], y.iloc[train_idx], cv=cv,
                               scoring={'roc': 'roc_auc'}, error_score='raise')
    model = logistic_pipeline().fit(x.iloc[train_idx], y.iloc[train_idx])
    y_test = y.iloc[test_idx]
    pred = model.predict_proba(x.iloc[test_idx])[:, 1]

    rng = np.random.default_rng(RANDOM_STATE)
    truth = y_test.to_numpy()
    boot = []
    for _ in range(1000):
        ix = rng.choice(len(truth), size=len(truth), replace=True)
        if len(np.unique(truth[ix])) < 2:
            continue
        boot.append(roc_auc_score(truth[ix], pred[ix]))
    boot_low, boot_high = np.quantile(boot, [0.025, 0.975])

    # The notebook's example: the first included loan's own pre-loan statement.
    example = analysis_df.iloc[0]
    example_tx = groups[example['account_id']]
    example_row = pd.DataFrame([cashflow_features(example_tx, example['loan_date'])])[FEATURE_NAMES]
    example_score = model.predict_proba(example_row)[0, 1]

    test_roc = roc_auc_score(y_test, pred)
    test_pr = average_precision_score(y_test, pred)
    test_brier = brier_score_loss(y_test, pred)
    print('Checking against the notebook:')
    results = [
        check('cv_roc_auc', cv_scores['test_roc'].mean()),
        check('test_roc_auc', test_roc),
        check('test_pr_auc', test_pr),
        check('test_brier', test_brier),
        check('boot_low', boot_low),
        check('boot_high', boot_high),
        check('example_score', example_score),
    ]
    if not all(results):
        raise SystemExit('Results differ from the notebook; nothing was written.')

    imputer = model.named_steps['imputer']
    scaler = model.named_steps['scaler']
    clf = model.named_steps['classifier']
    params = {
        'medians': imputer.statistics_.tolist(),
        'centers': scaler.center_.tolist(),
        'scales': scaler.scale_.tolist(),
        'coefficients': clf.coef_[0].tolist(),
        'intercept': float(clf.intercept_[0]),
    }

    def by_hand(row):
        z = [((params['medians'][i] if math.isnan(v) else v) - params['centers'][i]) / params['scales'][i]
             for i, v in enumerate(row)]
        logit = params['intercept'] + sum(c * zi for c, zi in zip(params['coefficients'], z))
        return 1 / (1 + math.exp(-logit))

    manual = np.array([by_hand(r) for r in x.iloc[test_idx].to_numpy(dtype=float)])
    assert np.max(np.abs(manual - pred)) < 1e-12, 'exported parameters do not reproduce the pipeline'

    train = analysis_df.iloc[train_idx]
    export = {
        'id': 'berka-cashflow-lr',
        'name': 'Berka cash-flow default model',
        'purpose': 'Course proof of concept (CSC491 A4). Not real underwriting.',
        'notebook': 'Berka_Cashflow_PD_Colab.ipynb',
        'featureSet': 'B: Cash flow only',
        'algorithm': 'Logistic regression (median imputer, robust scaler, balanced class weights)',
        'label': 'Loan finished and repaid (status A) = 0; loan finished and not repaid (status B) = 1',
        'windowDays': WINDOW_DAYS,
        'minimumTransactions': MIN_TX,
        'training': {
            'dataset': "PKDD'99 Berka",
            'lender': 'a Czech bank',
            'source': 'https://github.com/jlacko/berka-dataset',
            'currency': 'CZK',
            'firstLoanYear': int(analysis_df['loan_date'].min().year),
            'lastLoanYear': int(analysis_df['loan_date'].max().year),
            'finishedLoans': int(len(analysis_df)),
            'notRepaid': int(y.sum()),
            'trainedOnLoans': int(len(train)),
            'trainedOnNotRepaid': int(train['DEFAULT'].sum()),
        },
        'test': {
            'loans': int(len(test_idx)),
            'notRepaid': int(y_test.sum()),
            'rocAuc': float(test_roc),
            'rocAucInterval': [float(boot_low), float(boot_high)],
            'prAuc': float(test_pr),
            'brier': float(test_brier),
        },
        'features': [
            {'name': name, 'median': params['medians'][i], 'center': params['centers'][i],
             'scale': params['scales'][i], 'coefficient': params['coefficients'][i]}
            for i, name in enumerate(FEATURE_NAMES)
        ],
        'intercept': params['intercept'],
        'software': {'python': platform.python_version(), 'scikitLearn': sklearn.__version__,
                     'pandas': pd.__version__, 'numpy': np.__version__},
    }
    MODEL_OUT.write_text(json.dumps(export, indent=2) + '\n')
    print(f'Wrote {MODEL_OUT.relative_to(ROOT)}')

    cases = parity_cases()
    parity = []
    for name, statement in cases:
        df = pd.DataFrame(statement)
        df['tx_date'] = pd.to_datetime(df['date'])
        df['is_inflow'] = df['amount'] > 0
        df['is_outflow'] = ~df['is_inflow']
        df['amount'] = df['amount'].abs()
        as_of = (df['tx_date'].max() + pd.Timedelta(days=1)).strftime('%Y-%m-%d')
        f = cashflow_features(df, as_of, stable=True)
        score = float(model.predict_proba(pd.DataFrame([f])[FEATURE_NAMES])[0, 1])
        parity.append({
            'name': name,
            'asOf': as_of,
            'rows': statement,
            'features': {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in f.items()},
            'score': score,
        })
    PARITY_OUT.write_text(json.dumps({'_note': 'Generated by model/export.py. Invented statements.',
                                      'cases': parity}, indent=1) + '\n')
    print(f'Wrote {PARITY_OUT.relative_to(ROOT)} ({len(parity)} statements)')


def parity_cases():
    """Invented statements that exercise each branch of the feature builder."""
    rng = np.random.default_rng(7)
    start = pd.Timestamp('2026-03-01')

    def build(entries, opening):
        entries = sorted(entries, key=lambda e: e[0])
        out, balance = [], opening
        for day, amount in entries:
            balance = round(balance + amount, 2)
            out.append({'date': (start + pd.Timedelta(days=int(day))).strftime('%Y-%m-%d'),
                        'amount': round(float(amount), 2), 'balance': balance})
        return out

    def salaried(scale, days=230, spend=0.9):
        entries = [(d, scale * (1 + rng.normal(0, 0.03))) for d in range(3, days, 14)]
        entries += [(d, -scale * spend * rng.uniform(0.05, 0.4)) for d in rng.integers(0, days, 60)]
        return entries

    cases = [
        ('steady pay, koruna scale', build(salaried(15000), 20000)),
        ('steady pay, dollar scale', build(salaried(2000), 1500)),
        ('spends more than it earns', build(salaried(9000, spend=1.6), 500)),
    ]

    same_day = []
    for d in range(0, 190, 3):
        same_day += [(d, 900.0), (d, -450.5), (d, -300.25)]
    cases.append(('several transactions a day', build(same_day, 100)))

    gap = [(d, 12000.0) for d in range(0, 110, 30)] + [(d, -3000.0) for d in range(5, 110, 10)]
    cases.append(('nothing in the last 90 days but one', build(gap + [(199, -10.0)], 2000)))

    windfall = salaried(8000, days=200) + [(195, 60000.0), (198, -15000.0)]
    cases.append(('large deposit in the last 30 days', build(windfall, 3000)))

    cases.append(('no money in at all', build([(d, -40.0) for d in range(0, 200, 6)], 5000)))

    with_zero = salaried(5000, days=200) + [(100, 0.0), (150, 0.0)]
    cases.append(('zero-amount rows', build(with_zero, 800)))

    cases.append(('only five transactions', build([(10, 500.0), (60, -200.0), (100, 300.0), (150, -50.0),
                                                     (185, 1000.0)], 0)))
    return cases


if __name__ == '__main__':
    main()
