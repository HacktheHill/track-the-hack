import type { TestContext } from "node:test";
import { EventType, type Event } from "@prisma/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { observable } from "@trpc/server/observable";
import { createInstance } from "i18next";
import { SessionProvider } from "next-auth/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import type { ComponentProps, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import superjson from "superjson";
import type { AppRouter } from "@/server/api/root";
import EventPage from "@/pages/schedule/event";
import type EventEditor from "@/components/EventEditor";

export const PublicEvent = ({ router }: { router: NextRouter }) => (
	<RouterContext.Provider value={router}>
		<SessionProvider session={null}>
			<EventPage />
		</SessionProvider>
	</RouterContext.Provider>
);

type EventFixture = NonNullable<ComponentProps<typeof EventEditor>["event"]> & Pick<Event, "type" | "host" | "tiktok">;

export const event: EventFixture = {
	id: "event-1",
	name: "Opening ceremony",
	nameFr: "Cérémonie d'ouverture",
	room: "Auditorium",
	start: new Date("2026-09-25T14:00:00Z"),
	end: new Date("2026-09-25T15:00:00Z"),
	description: "Welcome\nto the event",
	descriptionFr: "Bienvenue\nà l'événement",
	hidden: false,
	type: EventType.ALL,
	host: null,
	tiktok: null,
	image: null,
	link: null,
	linkText: null,
	linkTextFr: null,
};

type Request = { path: string; input: unknown; succeed: () => void; fail: () => void };
const api = createTRPCReact<AppRouter>();

export const setup = async (t: TestContext) => {
	const requests: Request[] = [];
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, cacheTime: 0 }, mutations: { retry: false, cacheTime: 0 } },
		logger: { log: () => undefined, warn: () => undefined, error: () => undefined },
	});
	const client = api.createClient({
		transformer: superjson,
		links: [
			() =>
				({ op }) =>
					observable(observer => {
						requests.push({
							path: op.path,
							input: op.input,
							succeed: () => {
								observer.next({ result: { data: event } });
								observer.complete();
							},
							fail: () => observer.error(new TRPCClientError("Save failed")),
						});
					}),
		],
	});
	const i18n = createInstance();
	await i18n.init({ lng: "en", resources: {}, fallbackLng: "en", interpolation: { escapeValue: false } });
	t.after(() => queryClient.clear());
	const wrap = (children: ReactNode) => (
		<I18nextProvider i18n={i18n}>
			<api.Provider client={client} queryClient={queryClient}>
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			</api.Provider>
		</I18nextProvider>
	);
	return { requests, queryClient, wrap };
};
