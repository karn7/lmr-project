export function summarizeLottery(rows = []) {
  const groups = [
    { type: "สลากกินแบ่งรัฐบาล", percent: 0.5 },
    { type: "สลากการกุศล", percent: 1 },
    { type: "ไม่ระบุประเภท", percent: null },
  ].map((group) => ({ ...group, count: 0, gross: 0, paid: 0, invalid: 0 }));

  for (const row of rows) {
    for (const item of row.items ?? []) {
      const group = groups.find((g) => item.currency?.startsWith(g.type)) ?? groups[2];
      const amount = Number(item.amount);
      const rate = Number(item.rate);
      group.count += Number.isFinite(amount) ? amount : 0;
      group.paid += Number(item.total) || 0;
      if (item.rate == null || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(amount) || amount <= 0) {
        group.invalid += 1;
      } else {
        group.gross += Math.round(rate * amount * 100);
      }
    }
  }

  return groups.map((group) => {
    const deduction = Math.round(group.gross * (group.percent ?? 0) / 100);
    return {
      ...group,
      gross: group.gross / 100,
      deduction: deduction / 100,
      net: (group.gross - deduction) / 100,
    };
  });
}
