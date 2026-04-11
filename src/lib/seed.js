export const SEED_DATA = {
  rsuGrants:      [],
  incomeData:     {},
  rsuData:        {},
  investmentsData: {
    "FY2026-27": {
      epfOpening: { Selva: 0, Akshaya: 0 },
    },
  },
  expensesData: {
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
  portfolioData: {},
};
