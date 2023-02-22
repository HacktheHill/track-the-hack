import { hackerRouter } from "./routers/hackers";
import { userRouter } from "./routers/users";
import { eventsRouter } from "./routers/events";
import { presenceRouter } from "./routers/presence";
import { createTRPCRouter } from "./trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here
 */
export const appRouter = createTRPCRouter({
	users: userRouter,
	hackers: hackerRouter,
	events: eventsRouter,
	presence: presenceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
