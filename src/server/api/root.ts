import { logRouter } from "./routers/auditLog";
import { eventsRouter } from "./routers/events";
import { hackerRouter } from "./routers/hackers";
import { presenceRouter } from "./routers/presence";
import { sponsorshipGmailDraftsRouter } from "./routers/sponsorshipGmailDrafts";
import { userRouter } from "./routers/users";
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
	sponsorshipGmailDrafts: sponsorshipGmailDraftsRouter,
	log: logRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
