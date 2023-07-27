import { PrismaClient } from "@prisma/client";
import { generateUsers, insertRecords } from "./users.mjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating dummy users...");

  const users = generateUsers(10);
  await insertRecords(prisma.user, users);

}
main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Done!");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
