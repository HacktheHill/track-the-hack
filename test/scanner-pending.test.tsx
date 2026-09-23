import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import superjson from "superjson";
import PresenceCounter from "@/components/PresenceCounter";
import PhysicalScanner from "@/components/PhysicalScanner";
import { useScannerOperation, type ScannerOperation } from "@/components/useScannerOperation";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/api/root";
const trpc = createTRPCReact<AppRouter>();
import english from "@root/public/locales/en/qr.json";

type Request = { input: unknown; succeed: (value: number, atLimit: boolean) => void; fail: () => void };
const flush = async (action: () => void) => {
	await act(async () => {
		action();
		await setTimeout(0);
	});
};
const click = (renderer: ReactTestRenderer, label: string): (() => void) => {
	const handler: unknown = renderer.root.findByProps({ "aria-label": label }).props.onClick;
	return () => {
		assert.equal(typeof handler, "function");
		if (typeof handler === "function") handler();
	};
};

void test("pending adjustment blocks rapid clicks and scans; errors retain count and release the gate", async t => {
	const requests: Request[] = [];
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false, cacheTime: 0 } },
		logger: { log: () => undefined, warn: () => undefined, error: () => undefined },
	});
	t.after(() => queryClient.clear());
	const client = trpc.createClient({
		transformer: superjson,
		links: [
			() =>
				({ op }) =>
					observable(observer => {
						assert.equal(op.path, "presence.adjust");
						requests.push({
							input: op.input,
							succeed(value, atLimit) {
								observer.next({ result: { data: { value, atLimit } } });
								observer.complete();
							},
							fail() {
								observer.error(new TRPCClientError("Failed"));
							},
						});
					}),
		],
	});
	const i18n = createInstance();
	await i18n.init({ lng: "en", resources: { en: { qr: english } } });
	let operation: ScannerOperation | undefined;
	let scans = 0;
	const Host = () => {
		const state = useScannerOperation();
		operation = state.operation;
		return (
			<>
				<select disabled={state.pending} />
				<PhysicalScanner
					disabled={state.pending}
					onScan={() => {
						if (state.operation.begin()) {
							scans++;
							state.operation.end();
						}
					}}
				/>
				<PresenceCounter
					eventId="lunch"
					hackerId="participant"
					eventName="Lunch"
					initialValue={1}
					initialAtLimit={false}
					operation={state.operation}
				/>
			</>
		);
	};
	const renderer = create(
		<I18nextProvider i18n={i18n}>
			<trpc.Provider client={client} queryClient={queryClient}>
				<QueryClientProvider client={queryClient}>
					<Host />
				</QueryClientProvider>
			</trpc.Provider>
		</I18nextProvider>,
	);
	t.after(() => renderer.unmount());
	const originalOperation = operation;
	const increase = click(renderer, english["increase-count"]);
	await flush(() => {
		increase();
		increase();
		assert.equal(operation?.begin(), false);
	});
	assert.equal(requests.length, 1);
	assert.deepEqual(requests[0]?.input, { eventId: "lunch", hackerId: "participant", amount: 1 });
	assert.equal(operation, originalOperation, "camera callbacks can retain the stable gate");
	assert.equal(renderer.root.findByType("select").props.disabled, true);
	assert.equal(renderer.root.findByType("input").props.disabled, true);
	assert.equal(renderer.root.findByProps({ "aria-label": english["increase-count"] }).props.disabled, true);
	assert.equal(renderer.root.findByProps({ "aria-label": english["decrease-count"] }).props.disabled, true);
	assert.ok(JSON.stringify(renderer.toJSON()).includes(english.saving));
	await flush(() => {
		const submit: unknown = renderer.root.findByType("form").props.onSubmit;
		if (typeof submit === "function") submit({ preventDefault: () => undefined });
	});
	assert.equal(scans, 0);
	await flush(() => requests[0]?.fail());
	assert.equal(operation?.isPending(), false);
	assert.equal(renderer.root.findByType("select").props.disabled, false);
	assert.ok(JSON.stringify(renderer.toJSON()).includes(english["adjust-error"]));
	const count = () =>
		renderer.root
			.findAllByType("p")
			.find(p => p.children[0] === "Lunch")
			?.children.at(-1);
	assert.equal(count(), "1");
	await flush(click(renderer, english["increase-count"]));
	assert.equal(requests.length, 2);
	await flush(() => requests[1]?.succeed(2, true));
	assert.equal(count(), "2");
	assert.equal(renderer.root.findByProps({ "aria-label": english["increase-count"] }).props.disabled, true);
	assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 0);
	await flush(click(renderer, english["decrease-count"]));
	await flush(() => requests[2]?.succeed(0, false));
	assert.equal(count(), "0");
	assert.ok(JSON.stringify(renderer.toJSON()).includes(english["zero-count"]));
	assert.equal(renderer.root.findByProps({ "aria-label": english["decrease-count"] }).props.disabled, true);
	assert.equal(renderer.root.findByProps({ "aria-label": english["increase-count"] }).props.disabled, false);
	assert.equal(operation?.begin(), true, "new scans can start after saving");
	await flush(() => operation?.end());
});
