import { createTRPCRouter } from "./trpc";
import { userRouter } from "./routers/users";
import { hackerRouter } from "./routers/hackers";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here
 */
export const appRouter = createTRPCRouter({
    users: userRouter,
    hackers: hackerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
