import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 初始化种子数据 */
async function main() {
  await prisma.greeting.upsert({
    where: { id: "seed-greeting" },
    update: { message: "Hello Next!" },
    create: { id: "seed-greeting", message: "Hello Next!" },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
