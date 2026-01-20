
import { prisma } from './app/lib/prisma'
import { checkout } from './app/actions/checkout'
import { getFinancialReport, getTherapistPerformanceReport } from './app/actions/reports'
import { Prisma } from '@prisma/client'

async function main() {
  console.log('--- START REPRODUCTION ---')

  // 1. Setup Data
  console.log('Setting up data...')
  
  // Create Category
  const category = await prisma.customerCategory.create({
    data: {
      code: 'TEST_CAT_' + Date.now(),
      name: 'Test Category'
    }
  })

  // Create Treatment
  const treatment = await prisma.treatment.create({
    data: {
      name: 'Test Treatment',
      code: 'TR_' + Date.now(),
      duration: 60,
      costPrice: 50000,
      sellPrice: 100000,
      active: true,
      prices: {
        create: {
            categoryId: category.id,
            price: 100000
        }
      }
    }
  })

  // Create Therapist Level
  const level = await prisma.therapistLevel.create({
    data: {
      name: 'Test Level ' + Date.now(),
      defaultCommission: 10,
      minCommission: 5,
      maxCommission: 50
    }
  })

  // Create Main Therapist
  const therapist1 = await prisma.therapist.create({
    data: {
      name: 'Therapist 1 (Senior)',
      levelId: level.id,
      commissionPercent: 10,
      active: true
    }
  })

  // Create Assistant Therapist
  const therapist2 = await prisma.therapist.create({
    data: {
      name: 'Therapist 2 (Junior)',
      levelId: level.id,
      commissionPercent: 5, // Junior gets less
      active: true
    }
  })

  // Create Cashier (User) - Needed for checkout session
  const cashier = await prisma.user.create({
    data: {
      email: 'test_cashier_' + Date.now() + '@example.com',
      name: 'Test Cashier',
      role: 'KASIR'
    }
  })

  // 2. Perform Checkout
  console.log('Performing Checkout...')
  const checkoutSessionId = 'sess_' + Date.now()
  
  try {
      const result = await checkout({
        checkoutSessionId,
        paymentMethod: 'CASH',
        paidAmount: 100000,
        categoryCode: category.code,
        items: [
            {
                type: 'TREATMENT',
                treatmentId: treatment.id,
                therapistId: therapist1.id,
                assistantId: therapist2.id,
                qty: 1
            }
        ]
      }, cashier.id)
      console.log('Checkout successful:', result.number)
  } catch (e) {
      console.error('Checkout failed:', e)
      return
  }

  // 3. Verify Database State
  console.log('Verifying Database State...')
  const tx = await prisma.transaction.findFirst({
      where: { checkoutSessionId },
      include: {
          items: {
              include: {
                  commission: true
              }
          }
      }
  })

  if (!tx) {
      console.error('Transaction not found!')
      return
  }

  const item = tx.items[0]
  console.log('Transaction Item:', item.id)
  console.log('Therapist ID:', item.therapistId)
  console.log('Assistant ID:', item.assistantId)
  console.log('Commissions:', JSON.stringify(item.commission, null, 2))

  if (item.commission.length !== 2) {
      console.error('ERROR: Expected 2 commissions, found', item.commission.length)
  } else {
      console.log('SUCCESS: 2 commissions found.')
  }

  // 4. Test Reports
  console.log('Testing Reports...')
  const filters = {
      from: new Date(new Date().setHours(0,0,0,0)),
      to: new Date(new Date().setHours(23,59,59,999)),
      page: 1,
      limit: 10
  }

  // Financial Report
  const financialReport = await getFinancialReport(filters)
  const reportItem = financialReport.data.find(d => d.number === tx.number)
  
  if (reportItem) {
      console.log('Financial Report Item:', JSON.stringify(reportItem, null, 2))
      if (reportItem.therapists.includes('Therapist 1') && reportItem.therapists.includes('Therapist 2')) {
          console.log('SUCCESS: Both therapists shown in Financial Report.')
      } else {
          console.error('ERROR: Therapists missing in Financial Report.')
      }
      
      // Check commission display in financial report
      // Expected: Should ideally show total commission or details?
      // Current logic in getFinancialReport only picks item.commission?.[0]?.amount
      console.log('Report Commission Display:', reportItem.commission)
  } else {
      console.error('Transaction not found in Financial Report')
  }

  // Therapist Performance Report
  const perfReport = await getTherapistPerformanceReport(filters)
  
  const t1Stats = perfReport.data.find(d => d.therapistId === therapist1.id)
  const t2Stats = perfReport.data.find(d => d.therapistId === therapist2.id)

  console.log('Therapist 1 Stats:', t1Stats)
  console.log('Therapist 2 Stats:', t2Stats)

  if (t1Stats && t2Stats) {
      console.log('SUCCESS: Both therapists found in Performance Report.')
      if (Number(t2Stats.commission) > 0) {
          console.log('SUCCESS: Therapist 2 has commission.')
      } else {
          console.error('ERROR: Therapist 2 has 0 commission.')
      }
  } else {
      console.error('ERROR: One or both therapists missing in Performance Report.')
  }

  console.log('--- END REPRODUCTION ---')
}

main().catch(console.error)
