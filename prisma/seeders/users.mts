import { faker } from "@faker-js/faker";
import { Role, Language, PrismaClient } from "@prisma/client";

//generates dummy users
let user = () => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;
  const email = faker.internet.email();
  const phoneNumber = faker.phone.number();

  return {
    name,
    email,
    role: Role.HACKER,
    image: "https://i.pravatar.cc/50",
    hackerInfo: {
      create: {
        firstName,
        lastName,
        preferredLanguage: Language.EN,
        phoneNumber,
        email,
        emergencyContactName: "null",
        emergencyContactRelationship: "null",
        emergencyContactPhoneNumber: "null",
      },
    },
  };
};

/**
 * generates an array of users
 * @param n number of users to generate
 * @returns [] array of users
 */
function generateUsers(n = 10) {
  let users = [];
  for (let i = 0; i < n; i++) {
    users.push(user());
  }
  return users;
}

async function insertRecords(db: iDatabaseTable, rows: object[]) {
  try {
    rows.map(async (row) => {
      await db.create({
        data: user,
      });
    });
  } catch (e) {
    console.log(e);
  }
}

export interface iDatabaseTable {
  findMany(fields: object): any;
  findUnique(criteria: object): any;
  update(data: object): any;
  delete(data: object): any;
  create(data: object): any;
}

export { generateUsers, insertRecords };
