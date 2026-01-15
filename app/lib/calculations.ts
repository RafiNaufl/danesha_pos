import { Prisma, DiscountType } from '@prisma/client'

function round2(amount: Prisma.Decimal) {
  // Financial rounding enforced globally (HALF_UP, 2dp)
  return amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function calcLineTotals(unitPrice: Prisma.Decimal, qty: number, discountType: DiscountType | null, discountValue: Prisma.Decimal, costPrice: Prisma.Decimal) {
  // INVARIANT: Diskon berasal dari input kasir (manual), bukan auto dari tabel Discount.
  // INVARIANT: Komisi dihitung dari lineTotal (setelah diskon); report membaca snapshot, tidak hitung ulang.
  const q = new Prisma.Decimal(qty)
  const up = round2(unitPrice)
  const cp = round2(costPrice)
  const dv = round2(discountValue)

  const subtotal = round2(up.mul(q))
  let lineDiscount = new Prisma.Decimal(0)
  if (discountType === 'PERCENT') lineDiscount = round2(subtotal.mul(dv).div(100))
  else if (discountType === 'NOMINAL') lineDiscount = dv
  if (lineDiscount.greaterThan(subtotal)) lineDiscount = subtotal
  const lineTotal = round2(subtotal.sub(lineDiscount))
  const costTotal = round2(cp.mul(q))
  const profit = round2(lineTotal.sub(costTotal))
  return { subtotal, lineDiscount, lineTotal, costTotal, profit }
}
