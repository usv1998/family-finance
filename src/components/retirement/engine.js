// Pure financial calculation engine — no DOM, no side effects

export const LAKH  = 100_000;
export const CRORE = 10_000_000;

// ── Formatters ────────────────────────────────────────────────────────────────
export const fmtCr = (n) => {
  if (n == null || isNaN(n)) return "₹0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= CRORE)       return `${sign}₹${(abs / CRORE).toFixed(2)} Cr`;
  if (abs >= LAKH)        return `${sign}₹${(abs / LAKH).toFixed(1)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
};

// ── Default plan assumptions ──────────────────────────────────────────────────
export const DEFAULT_ASSUMPTIONS = {
  schema_version: 1,
  profile: { current_age: 28, retirement_age: 45, end_age: 80 },
  home: {
    property_value: 2 * CRORE,
    down_payment_pct: 0.30,
    stamp_duty_pct: 0.066,
    interiors: 15 * LAKH,
    loan_rate: 0.0875,
    loan_tenure_years: 20,
    annual_prepayment: 15 * LAKH,
  },
  starting_position: { liquid_investments: 50 * LAKH, epf_ppf: 5 * LAKH },
  income: { salary_monthly: 2.5 * LAKH, salary_growth: 0.10, rsu_annual_post_tax: 0 },
  expenses: { monthly: 1.5 * LAKH, growth: 0.07 },
  child: { education_target: 2 * CRORE, years_until_college: 18, expected_return: 0.10 },
  retirement: {
    pre_retirement_return: 0.12,
    sip_growth: 0.05,
    targets: {
      "50k":  9.85  * CRORE,
      "75k":  15.87 * CRORE,
      "1L":   21.16 * CRORE,
      "1.5L": 31.73 * CRORE,
    },
  },
  general: { investment_return: 0.12, home_appreciation: 0.05 },
};

// ── Home loan ────────────────────────────────────────────────────────────────
export function computeHomeLoan(a) {
  const { property_value, down_payment_pct, stamp_duty_pct, interiors,
          loan_rate, loan_tenure_years, annual_prepayment } = a.home;

  if (!property_value) return null;

  const down_payment = property_value * down_payment_pct;
  const stamp        = property_value * stamp_duty_pct;
  const upfront_cash = down_payment + stamp + interiors;
  const loan_amount  = property_value - down_payment;

  if (loan_amount <= 0) {
    return { upfront_cash, loan_amount: 0, monthly_emi: 0, emi_as_pct_of_income: 0,
             effective_closure_years: 0, total_interest_paid: 0, balance_curve: [0] };
  }

  const r = loan_rate / 12;
  const n = loan_tenure_years * 12;
  const emi = r > 0
    ? loan_amount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
    : loan_amount / n;

  // Amortize with annual prepayment
  let balance = loan_amount;
  let totalInterest = 0;
  let months = 0;
  const balance_curve = [balance];
  let yearBalance = balance;

  outer: for (let yr = 1; yr <= loan_tenure_years + 5; yr++) {
    for (let m = 1; m <= 12; m++) {
      if (balance <= 0) break outer;
      const interest = balance * r;
      const principal = Math.min(emi - interest, balance);
      totalInterest += interest;
      balance -= principal;
      months++;
    }
    if (balance > 0 && annual_prepayment > 0) {
      balance = Math.max(0, balance - annual_prepayment);
    }
    balance_curve.push(Math.max(0, balance));
    if (balance <= 0) break;
  }

  const monthly_income = a.income.salary_monthly + a.income.rsu_annual_post_tax / 12;

  return {
    upfront_cash,
    loan_amount,
    monthly_emi: emi,
    emi_as_pct_of_income: monthly_income > 0 ? emi / monthly_income : 0,
    effective_closure_years: months / 12,
    total_interest_paid: totalInterest,
    surplus_year_1: monthly_income - a.expenses.monthly - emi,
    surplus_year_10: (monthly_income * Math.pow(1 + a.income.salary_growth, 10))
                   - (a.expenses.monthly * Math.pow(1 + a.expenses.growth, 10)) - emi,
    balance_curve,
  };
}

// ── Approaches comparison ─────────────────────────────────────────────────────
const APPROACHES = [
  { key: "aggressive",   name: "Aggressive",    dp_pct: 0.50, tenure_years: 15, annual_prepay: 25 * LAKH },
  { key: "balanced",     name: "Balanced",      dp_pct: 0.30, tenure_years: 20, annual_prepay: 15 * LAKH },
  { key: "max_leverage", name: "Max Leverage",  dp_pct: 0.20, tenure_years: 25, annual_prepay: 0 },
];

export function computeApproaches(a, yearN = 10) {
  const results = APPROACHES.map(ap => {
    const aa = { ...a, home: { ...a.home, down_payment_pct: ap.dp_pct, loan_tenure_years: ap.tenure_years, annual_prepayment: ap.annual_prepay } };
    const hl  = computeHomeLoan(aa);
    if (!hl) return null;

    const r_monthly   = a.general.investment_return / 12;
    const ha_monthly  = a.general.home_appreciation / 12;
    const trajectory  = [];
    let portfolio     = a.starting_position.liquid_investments - hl.upfront_cash;
    let home_value    = a.home.property_value;
    let loan_balance  = hl.loan_amount;

    for (let yr = 0; yr <= 25; yr++) {
      trajectory.push({ year: yr, portfolio, home_value, loan_balance: Math.max(0, loan_balance), net_worth: portfolio + home_value - Math.max(0, loan_balance) });
      for (let m = 0; m < 12; m++) {
        const salary_m = a.income.salary_monthly * Math.pow(1 + a.income.salary_growth / 12, yr * 12 + m);
        const exp_m    = a.expenses.monthly      * Math.pow(1 + a.expenses.growth      / 12, yr * 12 + m);
        const interest = loan_balance > 0 ? loan_balance * (a.home.loan_rate / 12) : 0;
        const principal_m = loan_balance > 0 ? Math.min(hl.monthly_emi - interest, loan_balance) : 0;
        loan_balance  = Math.max(0, loan_balance - principal_m);
        const surplus = salary_m + a.income.rsu_annual_post_tax / 12 - exp_m - hl.monthly_emi;
        portfolio     = portfolio * (1 + r_monthly) + Math.max(0, surplus);
        home_value    = home_value * (1 + ha_monthly);
      }
      if (loan_balance > 0) loan_balance = Math.max(0, loan_balance - ap.annual_prepay);
    }

    return { ...ap, trajectory, at_year_n: trajectory[Math.min(yearN, trajectory.length - 1)] };
  }).filter(Boolean);

  const winner = results.reduce((best, ap) =>
    ap.at_year_n.net_worth > best.at_year_n.net_worth ? ap : best, results[0]);

  return { approaches: results, winner_key: winner?.key, baseline_net_worth: results[0]?.at_year_n.net_worth };
}

// ── Child SIP ────────────────────────────────────────────────────────────────
export function computeChildSip(a) {
  const { education_target, years_until_college, expected_return } = a.child;
  const r = expected_return / 12;
  const n = years_until_college * 12;
  if (n <= 0) return 0;
  const pmt = r > 0 ? education_target * r / (Math.pow(1 + r, n) - 1) : education_target / n;
  return pmt;
}

// ── Retirement / Lifetime plan ────────────────────────────────────────────────
export function computeLifetimePlan(a, scenario_key) {
  const hl = computeHomeLoan(a);
  const child_sip = computeChildSip(a);
  const target_corpus = a.retirement.targets[scenario_key] || a.retirement.targets["1L"];

  const N = a.profile.retirement_age - a.profile.current_age;
  const r = a.retirement.pre_retirement_return;
  const g = a.retirement.sip_growth;

  // Organic corpus growth (starting liquid)
  const organic = a.starting_position.liquid_investments * Math.pow(1 + r, N)
                + a.starting_position.epf_ppf * Math.pow(1 + r, N);

  const needed = target_corpus - organic;

  let retirement_sip_year_1 = 0;
  if (needed > 0) {
    // Growing annuity: PMT = needed * (r-g) / ((1+r)^N - (1+g)^N)
    const denom = r !== g
      ? (Math.pow(1 + r, N) - Math.pow(1 + g, N))
      : N * Math.pow(1 + r, N - 1);
    retirement_sip_year_1 = needed * (r - g) / denom / 12; // monthly
    if (retirement_sip_year_1 < 0) retirement_sip_year_1 = 0;
  }

  const year_data = [];
  let emi_active_until = hl ? Math.ceil(hl.effective_closure_years) : 0;

  for (let i = 0; i < N; i++) {
    const age = a.profile.current_age + i;
    const exp_monthly    = a.expenses.monthly * Math.pow(1 + a.expenses.growth, i);
    const emi_monthly    = (hl && i < emi_active_until) ? hl.monthly_emi : 0;
    const prepay_monthly = (hl && i < emi_active_until && a.home.annual_prepayment > 0) ? a.home.annual_prepayment / 12 : 0;
    const ret_sip        = retirement_sip_year_1 * Math.pow(1 + g, i);
    const total_outflow  = exp_monthly + emi_monthly + prepay_monthly + child_sip + ret_sip;
    const proj_salary    = a.income.salary_monthly * Math.pow(1 + a.income.salary_growth, i);
    const rsu_monthly    = a.income.rsu_annual_post_tax / 12;
    const gap            = Math.max(0, total_outflow - proj_salary);

    year_data.push({ age, exp_monthly, emi_monthly, prepay_monthly,
      child_sip_monthly: child_sip, retirement_sip_monthly: ret_sip,
      total_outflow_monthly: total_outflow, projected_salary_monthly: proj_salary,
      rsu_monthly, gap_monthly: gap });
  }

  const avg_min_1_6 = year_data.slice(0, 6).reduce((s, y) => s + y.total_outflow_monthly, 0) / Math.min(6, year_data.length);
  const post_loan   = year_data.slice(emi_active_until);
  const avg_post    = post_loan.length ? post_loan.reduce((s, y) => s + y.total_outflow_monthly, 0) / post_loan.length : 0;
  const peak        = year_data.reduce((best, y) => y.total_outflow_monthly > best.total_outflow_monthly ? y : best, year_data[0] || {});

  const max_gap    = Math.max(...year_data.map(y => y.gap_monthly));
  const rsu_needed = max_gap * 12;
  const rsu_pct    = a.income.rsu_annual_post_tax > 0 ? rsu_needed / a.income.rsu_annual_post_tax : (max_gap > 0 ? Infinity : 0);

  let verdict;
  if (max_gap <= 0)          verdict = "covered_by_salary";
  else if (rsu_pct < 0.8)   verdict = "covered_with_rsu";
  else if (rsu_pct < 1.2)   verdict = "tight";
  else                       verdict = "does_not_close";

  return {
    scenario_key,
    retirement_sip_year_1,
    organic_corpus_at_retirement: organic,
    target_corpus,
    is_overfunded: needed <= 0,
    year_data,
    summary: {
      avg_min_salary_years_1_6: avg_min_1_6,
      avg_min_salary_after_loan: avg_post,
      peak_min_salary: peak?.total_outflow_monthly || 0,
      peak_age: peak?.age || 0,
    },
    verdict,
    peak_rsu_needed: rsu_needed,
    peak_rsu_pct: rsu_pct,
  };
}
