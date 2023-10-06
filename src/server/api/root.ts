import { eventsRouter } from "./routers/events";
import { followRouter } from "./routers/follow";
import { hackerRouter } from "./routers/hackers";
import { presenceRouter } from "./routers/presence";
import { toolsRouter } from "./routers/tools";
import { userRouter } from "./routers/users";
import { createTRPCRouter } from "./trpc";
import {auditLogRouter} from "./routers/auditLog";

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
	tools: toolsRouter,
	follow: followRouter,
	auditLog: auditLogRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
