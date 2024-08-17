import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            dateOfBirth: true,
        },
    })

    for (const user of users) {
        const age = calculateAge(user.dateOfBirth)

        await prisma.user.update({
            where: { id: user.id },
            data: { age: age },
        })
    }

    console.log('Age migration completed.')
}

function calculateAge(dateOfBirth) {
    const dob = new Date(dateOfBirth)
    const diffMs = Date.now() - dob.getTime()
    const ageDate = new Date(diffMs)
    return Math.abs(ageDate.getUTCFullYear() - 1970)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
