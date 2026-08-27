const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  console.log("⏳ Connecting to Neon Database via Prisma...");
  try {
    await prisma.$connect();
    console.log("✅ SUCCESS: Neon Database is CONNECTED and working perfectly!");
  } catch (error) {
    console.error("❌ FAIL: Connection Error ->", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();