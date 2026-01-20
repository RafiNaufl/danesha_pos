
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Therapist Levels...')

  const levels = [
    {
      name: 'Senior',
      defaultCommission: 10,
      minCommission: 5,
      maxCommission: 50,
    },
    {
      name: 'Junior',
      defaultCommission: 5,
      minCommission: 3,
      maxCommission: 30,
    }
  ]

  for (const level of levels) {
    await prisma.therapistLevel.upsert({
      where: { name: level.name },
      update: {
        defaultCommission: level.defaultCommission,
        minCommission: level.minCommission,
        maxCommission: level.maxCommission,
      },
      create: level,
    })
  }

  console.log('Therapist Levels seeded.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
