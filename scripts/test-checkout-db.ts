
import { PrismaClient, ItemType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting test...')
  
  const dummyTherapist = await prisma.therapist.findFirst()
  if (!dummyTherapist) {
      console.log('No therapist found')
      return
  }
  
  const dummyTreatment = await prisma.treatment.findFirst()
  if (!dummyTreatment) {
      console.log('No treatment found')
      return
  }

  const dummyCategory = await prisma.customerCategory.findFirst()
  if (!dummyCategory) {
      console.log('No category found')
      return
  }

  const newUser = await prisma.user.create({
    data: {
      name: 'Test User',
      password: 'password',
      role: 'ADMIN',
      email: 'test' + Date.now() + '@example.com'
    }
  })
  const dummyUser = newUser

  console.log('User ID:', dummyUser.id)
  console.log('Category ID:', dummyCategory.id)
  console.log('Therapist ID:', dummyTherapist.id)
  console.log('Treatment ID:', dummyTreatment.id)

  const txItemsData = [{
    type: ItemType.TREATMENT,
    treatmentId: dummyTreatment.id,
    therapistId: dummyTherapist.id,
    assistantId: null,
    qty: 1,
    unitPrice: 100000,
    discountType: null,
    discountValue: 0,
    lineSubtotal: 100000,
    lineDiscount: 0,
    lineTotal: 100000,
    costPrice: 0,
    profit: 100000,
    commission: {
      create: [{
        therapistId: dummyTherapist.id,
        percent: 10,
        amount: 10000,
        commissionBaseAmount: 100000,
        commissionPercent: 10,
        commissionAmount: 10000
      }]
    }
  }]

  try {
    console.log('Verifying user exists:', await prisma.user.findUnique({ where: { id: dummyUser.id } }))

    const t = await prisma.transaction.create({
      data: ({
        number: 'TEST-' + Date.now(),
        checkoutSessionId: 'test-session-' + Date.now(),
        cashier: { connect: { id: dummyUser.id } },
        category: { connect: { id: dummyCategory.id } },
        status: 'PAID',
        subtotal: 100000,
        discountTotal: 0,
        total: 100000,
        costTotal: 0,
        profitTotal: 100000,
        commissionTotal: 10000,
        paymentMethod: 'CASH',
        paidAmount: 100000,
        changeAmount: 0,
        // items omitted for now
      } as any)
    })
    console.log('Transaction created without items:', t.id)
  } catch (e) {
    console.error('Error creating transaction:', e)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
