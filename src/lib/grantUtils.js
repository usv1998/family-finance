// Pure utilities for RSU grant modelling

export function dateToFY(dateStr) {
  const d = new Date(dateStr);
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  const fyYear = m >= 3 ? y : y - 1;
  return `FY${fyYear}-${(fyYear + 1).toString().slice(2)}`;
}

// Generate the full vest schedule from a grant definition
export function generateVestSchedule(grant) {
  if (grant.vesting_type === "custom") {
    return (grant.vesting_schedule || []).map(v => ({ ...v, units: Number(v.units) || 0 }));
  }
  // Equal quarterly
  const count    = (grant.vesting_years || 1) * 4;
  const base     = Math.floor((grant.total_units || 0) / count);
  const extra    = (grant.total_units || 0) - base * count;
  const schedule = [];
  const origin   = new Date(grant.first_vest_date);
  for (let i = 0; i < count; i++) {
    const d = new Date(origin);
    d.setMonth(origin.getMonth() + i * 3);
    schedule.push({
      vest_date: d.toISOString().slice(0, 10),
      units:     base + (i === 0 ? extra : 0),
    });
  }
  return schedule;
}

// Return true if a projected vest has a matching confirmed actual event (±7 days, same person+stock)
export function isConfirmed(vestDate, person, stock, rsuData) {
  const fy     = dateToFY(vestDate);
  const events = rsuData?.[fy] || [];
  const t      = new Date(vestDate).getTime();
  return events.some(e =>
    e.person === person &&
    e.stock  === stock  &&
    Math.abs(new Date(e.vest_date).getTime() - t) <= 7 * 86400 * 1000,
  );
}

// Get the matching actual event for a projected vest (returns event or null)
export function getConfirmedEvent(vestDate, person, stock, rsuData) {
  const fy     = dateToFY(vestDate);
  const events = rsuData?.[fy] || [];
  const t      = new Date(vestDate).getTime();
  return events.find(e =>
    e.person === person &&
    e.stock  === stock  &&
    Math.abs(new Date(e.vest_date).getTime() - t) <= 7 * 86400 * 1000,
  ) || null;
}

// Get next N upcoming vest dates across all grants (from today onwards)
export function getUpcomingVests(grants, n = 3) {
  const today = Date.now();
  const rows  = [];
  for (const g of grants) {
    for (const v of generateVestSchedule(g)) {
      const t = new Date(v.vest_date).getTime();
      if (t >= today) rows.push({ ...v, person: g.person, stock: g.stock, grantId: g.grant_id });
    }
  }
  rows.sort((a, b) => new Date(a.vest_date) - new Date(b.vest_date));
  return rows.slice(0, n);
}
