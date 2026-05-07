export const fmtNumber = (n: number, digits = 3) => {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  return rounded.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
  });
};

export const fmtMoney = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  return (
    n.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }) + " ₽"
  );
};
