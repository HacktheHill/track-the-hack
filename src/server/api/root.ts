import { auditLogRouter } from "./routers/auditLog";
import { eventsRouter } from "./routers/events";
import { followRouter } from "./routers/follow";
import { hackerRouter } from "./routers/hackers";
import { paymentRouter } from "./routers/payment";
import { presenceRouter } from "./routers/presence";
import { sponsorshipRouter } from "./routers/sponsorship";
import { responseRouter } from "./routers/response";
import { questionRouter} from "./routers/question";
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
	sponsorshipGmailDrafts: sponsorshipRouter,
	sponsorship: sponsorshipRouter,
	follow: followRouter,
	auditLog: auditLogRouter,
	payment: paymentRouter,
	question: questionRouter,
	response: responseRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
