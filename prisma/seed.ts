import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@danesha.com' },
    update: {
      password: 'admin123',
      role: 'ADMIN',
      name: 'Admin Danesha'
    },
    create: {
      id: 'user-admin-01', // Fixed ID for DX
      email: 'admin@danesha.com',
      name: 'Admin Danesha',
      password: 'admin123',
      role: 'ADMIN',
    },
  })

  // Create Kasir
  const kasir = await prisma.user.upsert({
    where: { email: 'kasir@danesha.com' },
    update: {
      password: 'kasir123',
      role: 'KASIR',
      name: 'Kasir 1'
    },
    create: {
      id: 'user-kasir-01', // Fixed ID for DX
      email: 'kasir@danesha.com',
      name: 'Kasir 1',
      password: 'kasir123',
      role: 'KASIR',
    },
  })

  const categories = [
    { code: 'PASIEN', name: 'Pasien' },
    { code: 'RESELLER', name: 'Reseller' },
    { code: 'MEMBER', name: 'Member' },
    { code: 'AGEN', name: 'Agen' },
  ]
  const createdCategories: Record<string, any> = {}
  for (const c of categories) {
    const cat = await prisma.customerCategory.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: { code: c.code, name: c.name },
    })
    createdCategories[c.code] = cat
  }

  // Seed Therapists
  const therapists = [
    { name: 'Dr. Tirta', phone: '081234567890' },
    { name: 'Suster Siti', phone: '081234567891' },
    { name: 'Bidan Ani', phone: '081234567892' },
  ]
  
  for (const t of therapists) {
    await prisma.therapist.upsert({
      where: { id: t.name.replace(/\s+/g, '-').toLowerCase() }, // Use name-based ID for idempotency in seed
      update: { name: t.name, phone: t.phone },
      create: { 
        id: t.name.replace(/\s+/g, '-').toLowerCase(),
        name: t.name, 
        phone: t.phone 
      },
    })
  }

  // Seed Products
  const products = [
    { 
      name: 'Serum Anti Aging', 
      costPrice: 150000, 
      unit: 'btl',
      prices: { PASIEN: 250000, MEMBER: 225000, RESELLER: 200000 } 
    },
    { 
      name: 'Facial Wash Tea Tree', 
      costPrice: 35000, 
      unit: 'btl',
      prices: { PASIEN: 60000, MEMBER: 54000, RESELLER: 48000 } 
    },
    { 
      name: 'Sunscreen SPF 50', 
      costPrice: 45000, 
      unit: 'tube',
      prices: { PASIEN: 85000, MEMBER: 76500, RESELLER: 68000 } 
    },
  ]

  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { id: p.name.replace(/\s+/g, '-').toLowerCase() },
      update: { name: p.name, costPrice: p.costPrice, unit: p.unit },
      create: { 
        id: p.name.replace(/\s+/g, '-').toLowerCase(),
        name: p.name, 
        costPrice: p.costPrice,
        unit: p.unit
      },
    })

    // Seed Prices
    for (const [code, price] of Object.entries(p.prices)) {
      if (createdCategories[code]) {
        await prisma.productPrice.upsert({
          where: {
            productId_categoryId: {
              productId: prod.id,
              categoryId: createdCategories[code].id
            }
          },
          update: { price: price },
          create: {
            productId: prod.id,
            categoryId: createdCategories[code].id,
            price: price
          }
        })
      }
    }

    // Seed Initial Stock (if none exists)
    const stock = await prisma.stockMovement.findFirst({ where: { productId: prod.id } })
    if (!stock) {
      await prisma.stockMovement.create({
        data: {
          productId: prod.id,
          type: 'IN',
          quantity: 100,
          unitCost: p.costPrice,
          note: 'Initial Seed Stock'
        }
      })
    }
  }

  // Seed Treatments
  const treatments = [
    { 
      name: 'Facial Basic', 
      costPrice: 25000, 
      sellPrice: 100000, // Base price
      prices: { PASIEN: 100000, MEMBER: 90000 }
    },
    { 
      name: 'Laser Rejuvenation', 
      costPrice: 150000, 
      sellPrice: 500000, 
      prices: { PASIEN: 500000, MEMBER: 450000 }
    },
    { 
      name: 'Chemical Peeling', 
      costPrice: 50000, 
      sellPrice: 250000, 
      prices: { PASIEN: 250000, MEMBER: 225000 }
    },
  ]

  for (const t of treatments) {
    const treat = await prisma.treatment.upsert({
      where: { id: t.name.replace(/\s+/g, '-').toLowerCase() },
      update: { name: t.name, costPrice: t.costPrice, sellPrice: t.sellPrice } as any,
      create: { 
        id: t.name.replace(/\s+/g, '-').toLowerCase(),
        name: t.name, 
        costPrice: t.costPrice, 
        sellPrice: t.sellPrice
      } as any,
    })

    // Seed Treatment Prices
    for (const [code, price] of Object.entries(t.prices)) {
      if (createdCategories[code]) {
        await prisma.treatmentPrice.upsert({
          where: {
            treatmentId_categoryId: {
              treatmentId: treat.id,
              categoryId: createdCategories[code].id
            }
          },
          update: { price: price },
          create: {
            treatmentId: treat.id,
            categoryId: createdCategories[code].id,
            price: price
          }
        })
      }
    }
  }

  console.log({ admin, kasir, categories, therapists: therapists.length, products: products.length, treatments: treatments.length })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
