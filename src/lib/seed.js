export const SEED_DATA = {
  // Flat array — grants span multiple FYs, not scoped to one FY
  rsuGrants: [
    {
      id: "grant-selva-fy27",
      person: "Selva", stock: "MSFT",
      grant_date: "2025-02-15",
      grant_id: "MSFT-FY27-Refresh",
      total_units: 56,
      vesting_type: "quarterly",
      vesting_years: 1,
      first_vest_date: "2026-05-15",
      vesting_schedule: [],
      notes: "56 shares, 14/vest, quarterly May/Aug/Nov/Feb",
    },
    {
      id: "grant-akshaya-fy27",
      person: "Akshaya", stock: "NVDA",
      grant_date: "2025-06-15",
      grant_id: "NVDA-FY27-Annual",
      total_units: 461,
      vesting_type: "custom",
      vesting_years: 1,
      first_vest_date: "",
      vesting_schedule: [
        { vest_date: "2026-06-15", units: 160 },
        { vest_date: "2026-09-15", units: 101 },
        { vest_date: "2026-12-15", units: 100 },
        { vest_date: "2027-03-15", units: 100 },
      ],
      notes: "461 shares: Jun 160 / Sep 101 / Dec 100 / Mar 100",
    },
  ],
  incomeData: {
    "FY2026-27": {
      Selva: {
        0:  { take_home:133121, epf:16704, espp_shares:3,  espp_price_usd:420, espp_usd_inr:94, car_lease:50706, ad_hoc:[], notes:"Apr — MSFT ESPP vest: 3 shares @ $420×₹94 = ₹1,18,440" },
        1:  { take_home:133171, epf:16704, car_lease:50706, ad_hoc:[], notes:"May — MSFT RSU 14 shares vest" },
        2:  { take_home:133171, epf:16704, car_lease:50706, ad_hoc:[], notes:"" },
        3:  { take_home:133171, epf:16704, espp_shares:3,  espp_price_usd:420, espp_usd_inr:94, car_lease:50706, ad_hoc:[], notes:"Jul — MSFT ESPP vest: 3 shares @ $420×₹94 = ₹1,18,440" },
        4:  { take_home:133171, epf:16704, car_lease:50706, ad_hoc:[], notes:"Aug — MSFT RSU 14 shares vest" },
        5:  { take_home:425938, epf:17372, car_lease:50706, ad_hoc:[], notes:"Sep — 4% hike + bonus ₹3,62,158 included in take-home. TDS recalculated." },
        6:  { take_home:125648, epf:17372, espp_shares:5,  espp_price_usd:420, espp_usd_inr:94, car_lease:50706, ad_hoc:[], notes:"Oct — MSFT ESPP vest: 5 shares @ $420×₹94 = ₹1,97,400 (Sep bonus boosted ESPP base)" },
        7:  { take_home:125648, epf:17372, car_lease:50706, ad_hoc:[], notes:"Nov — MSFT RSU 14 shares vest" },
        8:  { take_home:113296, epf:17372, car_lease:50706, ad_hoc:[], notes:"Dec — Nov RSU recalc raises TDS" },
        9:  { take_home:113296, epf:17372, espp_shares:3,  espp_price_usd:420, espp_usd_inr:94, car_lease:50706, ad_hoc:[], notes:"Jan — MSFT ESPP vest: 3 shares @ $420×₹94 = ₹1,18,440" },
        10: { take_home:113196, epf:17372, car_lease:50706, ad_hoc:[], notes:"Feb — MSFT RSU 14 shares vest" },
        11: { take_home:5097,   epf:17372, car_lease:50706, ad_hoc:[], notes:"Mar — Surcharge catch-up. Only ₹5,097 cash take-home!" },
      },
      Akshaya: {
        0:  { take_home:147323, epf:17198, ad_hoc:[], notes:"" },
        1:  { take_home:147373, epf:17198, ad_hoc:[], notes:"" },
        2:  { take_home:219767, epf:17198, ad_hoc:[], notes:"Jun — NVDA RSU 160 shares vest" },
        3:  { take_home:156776, epf:17198, ad_hoc:[], notes:"" },
        4:  { take_home:156776, epf:17198, ad_hoc:[], notes:"" },
        5:  { take_home:332268, epf:17372, espp_shares:47, espp_price_usd:180, espp_usd_inr:94, ad_hoc:[], notes:"Sep — NVDA RSU 101 shares + ESPP vest 47 shares @ $180×₹94 = ₹7,95,240" },
        6:  { take_home:128813, epf:17372, ad_hoc:[], notes:"Oct — Lowest cash month. OPD insurance deduction + elevated TDS." },
        7:  { take_home:146626, epf:17372, ad_hoc:[], notes:"" },
        8:  { take_home:191732, epf:17372, ad_hoc:[], notes:"Dec — NVDA RSU 100 shares vest" },
        9:  { take_home:164303, epf:17372, ad_hoc:[], notes:"" },
        10: { take_home:164203, epf:17372, ad_hoc:[], notes:"" },
        11: { take_home:132805, epf:17372, espp_shares:47, espp_price_usd:180, espp_usd_inr:94, ad_hoc:[], notes:"Mar — NVDA RSU 100 shares + ESPP 47 shares @ $180×₹94 = ₹7,95,240. 15% surcharge!" },
      },
    },
  },
  rsuData: {
    "FY2026-27": [
      { id:"rsu-s1", person:"Selva",   stock:"MSFT", vest_date:"2026-05-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:4,  grant_id:"MSFT-FY27", month_idx:1,  fy:"FY2026-27" },
      { id:"rsu-s2", person:"Selva",   stock:"MSFT", vest_date:"2026-08-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:4,  grant_id:"MSFT-FY27", month_idx:4,  fy:"FY2026-27" },
      { id:"rsu-s3", person:"Selva",   stock:"MSFT", vest_date:"2026-11-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:4,  grant_id:"MSFT-FY27", month_idx:7,  fy:"FY2026-27" },
      { id:"rsu-s4", person:"Selva",   stock:"MSFT", vest_date:"2027-02-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:5,  grant_id:"MSFT-FY27", month_idx:10, fy:"FY2026-27" },
      { id:"rsu-a1", person:"Akshaya", stock:"NVDA", vest_date:"2026-06-15", units_vested:160, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:50, grant_id:"NVDA-FY27", month_idx:2,  fy:"FY2026-27" },
      { id:"rsu-a2", person:"Akshaya", stock:"NVDA", vest_date:"2026-09-15", units_vested:101, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:32, grant_id:"NVDA-FY27", month_idx:5,  fy:"FY2026-27" },
      { id:"rsu-a3", person:"Akshaya", stock:"NVDA", vest_date:"2026-12-15", units_vested:100, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:31, grant_id:"NVDA-FY27", month_idx:8,  fy:"FY2026-27" },
      { id:"rsu-a4", person:"Akshaya", stock:"NVDA", vest_date:"2027-03-15", units_vested:100, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:36, grant_id:"NVDA-FY27", month_idx:11, fy:"FY2026-27" },
    ],
  },
  investmentsData: {
    "FY2025-26": {
      epfOpening: { Selva: 0, Akshaya: 0 },
      babyFund: { monthlyTarget: 50000, months: {} },
      debtFunds: [],
    },
    "FY2026-27": {
      epfOpening: { Selva: 363580, Akshaya: 349612 },
      babyFund: {
        monthlyTarget: 50000,
        months: { 0:50000, 1:50000, 2:50000, 3:50000, 4:50000, 5:50000, 6:50000, 7:50000, 8:50000, 9:50000, 10:50000, 11:50000 },
      },
      debtFunds: [],
    },
  },
  expensesData: {
    "FY2025-26": {
      categories: [
        { id:"rent",      name:"Rent",       budget:45000, color:"#3B82F6" },
        { id:"parents",   name:"Parents",    budget:20000, color:"#F59E0B" },
        { id:"groceries", name:"Groceries",  budget:15000, color:"#22C55E" },
        { id:"dining",    name:"Dining Out", budget:6000,  color:"#14B8A6" },
        { id:"shopping",  name:"Shopping",   budget:10000, color:"#A855F7" },
        { id:"travel",    name:"Travel",     budget:8000,  color:"#EC4899" },
        { id:"utilities", name:"Utilities",  budget:3000,  color:"#8B96AD" },
        { id:"medical",   name:"Medical",    budget:3000,  color:"#EF4444" },
        { id:"misc",      name:"Misc",       budget:5000,  color:"#5A6580" },
      ],
      actuals: {},
    },
    "FY2026-27": {
      categories: [
        { id:"rent",      name:"Rent",       budget:48000, color:"#3B82F6" },
        { id:"parents",   name:"Parents",    budget:20000, color:"#F59E0B" },
        { id:"groceries", name:"Groceries",  budget:15000, color:"#22C55E" },
        { id:"dining",    name:"Dining Out", budget:6000,  color:"#14B8A6" },
        { id:"shopping",  name:"Shopping",   budget:10000, color:"#A855F7" },
        { id:"travel",    name:"Travel",     budget:8000,  color:"#EC4899" },
        { id:"utilities", name:"Utilities",  budget:3000,  color:"#8B96AD" },
        { id:"medical",   name:"Medical",    budget:3000,  color:"#EF4444" },
        { id:"misc",      name:"Misc",       budget:5000,  color:"#5A6580" },
      ],
      actuals: {},
    },
  },
  portfolioData: {
    // Opening snapshot — portfolio state as of April 1, 2025 (before FY2025-26 starts)
    // Fill in via "Initialize Opening Balances" in the Portfolio tab
    opening: {
      stocks:         { MSFT: { shares: 0 }, NVDA: { shares: 0 } },
      sipCorpus:      0,   // total mutual fund corpus already accumulated
      epf:            { Selva: 0, Akshaya: 0 },
      gold:           { units: 0, pricePerUnit: 15100 },
      debtFunds:      [],
      babyFundCorpus: 0,
      otherEquity:    [],
      initialized:    false,
    },
    "FY2025-26": {
      stocks: { MSFT: { shares: 0 }, NVDA: { shares: 0 } },
      sips: [
        { id:"nifty50-26",   name:"Nifty 50 Index Fund",  monthly:14000, months:{} },
        { id:"midcap150-26", name:"Midcap 150 Index Fund", monthly:6000,  months:{} },
      ],
      gold: { units: 0, pricePerUnit: 15100 },
      otherEquity: [],
    },
    "FY2026-27": {
      stocks: { MSFT: { shares: 0 }, NVDA: { shares: 0 } },
      sips: [
        { id:"nifty50",   name:"Nifty 50 Index Fund",  monthly:14000, months:{} },
        { id:"midcap150", name:"Midcap 150 Index Fund", monthly:6000,  months:{} },
      ],
      gold: { units: 0, pricePerUnit: 15100 },
      otherEquity: [],
    },
  },
};
