
import { PrismaClient, ItemType } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst()
  if (!user) { console.log('No user'); return }

  const category = await prisma.customerCategory.findFirst()
  if (!category) { console.log('No category'); return }

  const product = await prisma.product.findFirst({ where: { active: true } })
  console.log('Product:', product?.name)

  const treatment = await prisma.treatment.findFirst({ where: { active: true } })
  console.log('Treatment:', treatment?.name)
  
  const therapist = await prisma.therapist.findFirst({ where: { active: true } })
  console.log('Therapist:', therapist?.name)

  if (!product || !treatment || !therapist) {
    console.log('Missing prerequisites'); 
    return 
  }

  const txItemsData: any[] = []

  // Add Product Item
  txItemsData.push({
    type: ItemType.PRODUCT,
    productId: product.id,
    qty: 1,
    unitPrice: 100,
    lineSubtotal: 100,
    lineDiscount: 0,
    lineTotal: 100,
    costPrice: 0,
    profit: 100,
  })

  // Add Treatment Item
  txItemsData.push({
    type: ItemType.TREATMENT,
    treatmentId: treatment.id,
    therapistId: therapist.id,
    assistantId: null,
    qty: 1,
    unitPrice: 200,
    lineSubtotal: 200,
    lineDiscount: 0,
    lineTotal: 200,
    costPrice: 0,
    profit: 200,
    commission: {
      create: [{
        therapistId: therapist.id,
        percent: 10,
        amount: 20,
        commissionBaseAmount: 200,
        commissionPercent: 10,
        commissionAmount: 20
      }]
    }
  })

  console.log('Attempting create with mixed items...')
  try {
      const t = await prisma.transaction.create({
          data: {
              number: 'TEST-MIXED-' + Date.now(),
              checkoutSessionId: 'sess-mixed-' + Date.now(),
              cashierId: user.id,
              categoryId: category.id,
              subtotal: 300,
              discountTotal: 0,
              total: 300,
              costTotal: 0,
              profitTotal: 300,
              commissionTotal: 20,
              status: 'PAID',
              paymentMethod: 'CASH',
              paidAmount: 300,
              changeAmount: 0,
              items: { 
                  create: txItemsData
              }
          },
          include: {
              items: true
          }
      })
      console.log('Success:', t.id)
  } catch (e) {
      console.error('Error:', e)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
