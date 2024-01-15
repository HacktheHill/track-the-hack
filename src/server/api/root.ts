import { eventsRouter } from "./routers/events";
import { followRouter } from "./routers/follow";
import { hackerRouter } from "./routers/hackers";
import { presenceRouter } from "./routers/presence";
import { questionRouter} from "./routers/question";
import { userRouter } from "./routers/users";
import { createTRPCRouter } from "./trpc";
import { auditLogRouter } from "./routers/auditLog";
import { sponsorshipRouter } from "./routers/sponsorship";
import { responseRouter } from "./routers/response";

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
	sponsorshipGmailDrafts: sponsorshipRouter,
	follow: followRouter,
	auditLog: auditLogRouter,
	question: questionRouter,
	response: responseRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
