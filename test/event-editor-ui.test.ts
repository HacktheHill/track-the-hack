import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { createElement, Fragment, type ReactNode, useState } from "react";
import ReactDOM from "react-dom";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { getQueryKey } from "@trpc/react-query";
import EventEditor from "@/components/EventEditor";
import { trpc } from "@/server/api/api";
import { event, setup } from "@root/test/helpers/event-ui";

const button = (renderer: ReactTestRenderer, label: string) =>
	renderer.root.findAllByType("button").find(node => node.children.includes(label)) ??
	assert.fail(`Missing ${label}`);

const clickHandler = (node: ReactTestInstance): (() => void) => {
	const handler: unknown = node.props.onClick;
	assert.equal(typeof handler, "function");
	return () => {
		if (typeof handler === "function") handler();
	};
};

const submitHandler = (renderer: ReactTestRenderer): (() => void) => {
	const handler: unknown = renderer.root.findByType("form").props.onSubmit;
	assert.equal(typeof handler, "function");
	return () => {
		if (typeof handler === "function") handler({ preventDefault: () => undefined });
	};
};

const change = (renderer: ReactTestRenderer, id: string, value: string) => {
	const handler: unknown = renderer.root.findByProps({ id }).props.onChange;
	assert.equal(typeof handler, "function");
	if (typeof handler === "function") handler({ target: { value } });
};

// React Query schedules observer updates on the next timer turn.
const flush = async (action: () => void) => {
	await act(async () => {
		action();
		await setTimeout(0);
	});
};

for (const mode of ["create", "update"]) {
	void test(`${mode}: rapid saves submit once, failure permits retry, and reopening resets the guard`, async t => {
		const { requests, queryClient, wrap } = await setup(t);
		queryClient.setQueryData(getQueryKey(trpc.events.manage, undefined, "query"), [event]);
		queryClient.setQueryData(getQueryKey(trpc.events.all, undefined, "query"), [event]);
		queryClient.setQueryData(getQueryKey(trpc.events.get, { id: event.id }, "query"), event);
		const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: { getElementById: () => ({}) },
		});
		t.after(() => {
			if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
			else Reflect.deleteProperty(globalThis, "document");
		});
		// Keep the actual component and hooks; render the portal inline in this DOM-free test.
		t.mock.method(ReactDOM, "createPortal", (children: ReactNode) => ({
			...createElement(Fragment, null, children),
			children,
		}));
		const EditorHost = () => {
			const [open, setOpen] = useState(true);
			return open
				? createElement(EventEditor, { event: mode === "update" ? event : null, onClose: () => setOpen(false) })
				: createElement("button", { onClick: () => setOpen(true) }, "Reopen");
		};
		const renderer = create(wrap(createElement(EditorHost)));
		t.after(() => renderer.unmount());
		const fill = () => {
			void act(() => {
				change(renderer, "event-name", event.name);
				change(renderer, "event-name-fr", event.nameFr);
				change(renderer, "event-room", event.room);
				change(renderer, "event-start", "2026-09-25T10:00");
				change(renderer, "event-end", "2026-09-25T11:00");
				change(renderer, "event-description", event.description);
				change(renderer, "event-description-fr", event.descriptionFr);
			});
		};
		void act(() => change(renderer, "event-name", ""));
		await flush(submitHandler(renderer));
		assert.equal(requests.length, 0);
		assert.equal(button(renderer, "Save").props.disabled, false);
		assert.equal(renderer.root.findByProps({ id: "event-name" }).props["aria-describedby"], "event-editor-error");
		fill();
		const save = submitHandler(renderer);
		const cancel = clickHandler(button(renderer, "Cancel"));
		await flush(() => {
			// Reuse the same handler within one React batch, before loading state can rerender.
			save();
			save();
			cancel();
		});
		assert.equal(requests.length, 1);
		assert.equal(requests[0]?.path, `events.${mode}`);
		assert.equal(button(renderer, "Save").props.disabled, true);
		assert.equal(button(renderer, "Cancel").props.disabled, true);
		await flush(save);
		assert.equal(requests.length, 1);

		await flush(() => requests[0]?.fail());
		assert.equal(button(renderer, "Save").props.disabled, false);
		assert.equal(button(renderer, "Cancel").props.disabled, false);
		assert.ok(
			renderer.root
				.findAllByType("p")
				.some(node => node.children.includes("The event could not be saved. Please try again.")),
		);
		await flush(submitHandler(renderer));
		assert.equal(requests.length, 2);
		assert.equal(button(renderer, "Save").props.disabled, true);
		assert.ok(
			!renderer.root
				.findAllByType("p")
				.some(node => node.children.includes("The event could not be saved. Please try again.")),
		);
		const saved = requests[1]?.input;
		assert.ok(
			saved &&
				typeof saved === "object" &&
				"description" in saved &&
				"descriptionFr" in saved &&
				"type" in saved &&
				"scannerWorkflow" in saved &&
				"maxCheckIns" in saved &&
				"host" in saved,
		);
		assert.equal(saved.description, event.description);
		assert.equal(saved.descriptionFr, event.descriptionFr);
		assert.equal(saved.type, event.type);
		assert.equal(saved.scannerWorkflow, event.scannerWorkflow);
		assert.equal(saved.maxCheckIns, event.maxCheckIns);
		assert.equal(saved.host, event.host);
		assert.ok(!("image" in saved));

		await flush(() => requests[1]?.succeed());
		assert.equal(
			queryClient.getQueryState(getQueryKey(trpc.events.manage, undefined, "query"))?.isInvalidated,
			true,
		);
		assert.equal(queryClient.getQueryState(getQueryKey(trpc.events.all, undefined, "query"))?.isInvalidated, true);
		assert.equal(
			queryClient.getQueryState(getQueryKey(trpc.events.get, { id: event.id }, "query"))?.isInvalidated,
			mode === "update",
		);
		await flush(clickHandler(button(renderer, "Reopen")));
		fill();
		await flush(submitHandler(renderer));
		assert.equal(requests.length, 3);
		await flush(() => requests[2]?.succeed());
		assert.ok(button(renderer, "Reopen"));
	});
}

void test("editor renders translated scanner controls and responsive shared styles", async t => {
	const { wrap } = await setup(t, "fr");
	const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	Object.defineProperty(globalThis, "document", { configurable: true, value: { getElementById: () => ({}) } });
	t.after(() => {
		if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
		else Reflect.deleteProperty(globalThis, "document");
	});
	t.mock.method(ReactDOM, "createPortal", (children: ReactNode) => ({
		...createElement(Fragment, null, children),
		children,
	}));
	const renderer = create(wrap(createElement(EventEditor, { event, onClose: () => undefined })));
	t.after(() => renderer.unmount());

	assert.ok(button(renderer, "Enregistrer"));
	assert.ok(button(renderer, "Annuler"));
	assert.equal(renderer.root.findByProps({ id: "event-type" }).props.className, "ui-field");
	assert.equal(renderer.root.findByProps({ id: "event-scanner-workflow" }).props.className, "ui-field");
	assert.equal(renderer.root.findByProps({ id: "event-max-check-ins" }).props.className, "ui-field");
	assert.equal(renderer.root.findByProps({ id: "event-host" }).props.className, "ui-field");
	assert.ok(renderer.root.findAllByType("option").some(option => option.children.includes("Présence à l'événement")));
	assert.ok(
		renderer.root
			.findAllByType("p")
			.some(node => node.children.includes("Les heures utilisent l'heure de l'Est (America/Toronto).")),
	);
	const dialogClassName: unknown = renderer.root.findByProps({ role: "dialog" }).props.className;
	if (typeof dialogClassName !== "string") assert.fail("Dialog must have responsive classes");
	assert.ok(dialogClassName.includes("max-h-[calc(100vh-2rem)]"));
	assert.ok(renderer.root.findAllByProps({ className: "grid grid-cols-1 gap-4 sm:grid-cols-2" }).length >= 4);
});
