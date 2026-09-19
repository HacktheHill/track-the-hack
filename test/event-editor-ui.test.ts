import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { createElement, Fragment, type ReactNode, useState } from "react";
import ReactDOM from "react-dom";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import EventEditor from "@/components/EventEditor";
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
		const { requests, wrap } = await setup(t);
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
		await flush(clickHandler(button(renderer, "Save")));
		assert.equal(requests.length, 0);
		assert.equal(button(renderer, "Save").props.disabled, false);
		fill();
		const save = clickHandler(button(renderer, "Save"));
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
		assert.ok(renderer.root.findAllByType("p").some(node => node.children.includes("Save failed")));
		await flush(clickHandler(button(renderer, "Save")));
		assert.equal(requests.length, 2);
		assert.equal(button(renderer, "Save").props.disabled, true);
		assert.ok(!renderer.root.findAllByType("p").some(node => node.children.includes("Save failed")));
		const saved = requests[1]?.input;
		assert.ok(saved && typeof saved === "object" && "description" in saved && "descriptionFr" in saved);
		assert.equal(saved.description, event.description);
		assert.equal(saved.descriptionFr, event.descriptionFr);

		await flush(() => requests[1]?.succeed());
		await flush(clickHandler(button(renderer, "Reopen")));
		fill();
		await flush(clickHandler(button(renderer, "Save")));
		assert.equal(requests.length, 3);
		await flush(() => requests[2]?.succeed());
		assert.ok(button(renderer, "Reopen"));
	});
}
