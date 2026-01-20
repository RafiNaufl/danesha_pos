
import { PrismaClient, ItemType } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const user = await prisma.user.findFirst()
  if (!user) { console.log('No user'); return }

  const category = await prisma.customerCategory.findFirst()
  if (!category) { console.log('No category'); return }

  const treatment = await prisma.treatment.findFirst()
  console.log('Treatment:', treatment)
  if (!treatment) { console.log('No treatment'); return }
  
  const therapist = await prisma.therapist.findFirst()
  console.log('Therapist:', therapist)
  if (!therapist) { console.log('No therapist'); return }

  try {
      const t = await prisma.transaction.create({
          data: {
              number: 'TEST-' + Date.now(),
              checkoutSessionId: 'sess-' + Date.now(),
              cashierId: user.id,
              categoryId: category.id,
              subtotal: 100,
              discountTotal: 0,
              total: 100,
              costTotal: 0,
              profitTotal: 100,
              commissionTotal: 0,
              items: { 
                  create: [{
                      type: ItemType.TREATMENT,
                      treatmentId: treatment.id,
                      therapistId: therapist.id,
                      assistantId: therapist.id, // Explicitly set assistantId
                      qty: 1,
                      unitPrice: 100,
                      lineSubtotal: 100,
                      lineDiscount: 0,
                      lineTotal: 100,
                      costPrice: 0,
                      profit: 100,
                  }]
              }
          }, // Removed 'as any' to check TS
          include: {
              items: {
                  include: { treatment: true, therapist: true, assistant: true }
              }
          }
      })
      console.log('Success:', t.id)
      console.log('Items:', JSON.stringify(t.items, null, 2))
  } catch (e) {
      console.error(e)
  }
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
