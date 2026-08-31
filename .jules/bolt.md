## 2024-08-31 - Database Connection Pool Exhaustion
**Learning:** Instantiating `new PrismaClient()` repeatedly in API routes or serverless functions can quickly exhaust database connection limits, leading to connection timeouts and severe performance degradation, particularly under load.
**Action:** Never instantiate `new PrismaClient()` directly in tRPC routers or helper files. Always use the globally cached `ctx.prisma` in tRPC endpoints or import the shared `prisma` instance from `src/server/db.ts` for other server-side operations.
