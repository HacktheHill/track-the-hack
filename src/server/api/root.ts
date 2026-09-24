import { eventsRouter } from "./routers/events";
import { hackerRouter } from "./routers/hackers";
import { presenceRouter } from "./routers/presence";
import { userRouter } from "./routers/users";
import { metricsRouter } from "./routers/metrics";
import { notificationsRouter } from "./routers/notifications";
import { createTRPCRouter } from "./trpc";
import { hardwareRouter } from "./routers/hardware";
import { latteLabRouter } from "./routers/latte-lab";

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
	metrics: metricsRouter,
	hardware: hardwareRouter,
	latteLab: latteLabRouter,
	notifications: notificationsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
