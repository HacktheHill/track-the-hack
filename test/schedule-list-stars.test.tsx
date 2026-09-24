import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getQueryKey } from "@trpc/react-query";
import ScheduleSaveButton from "@/components/ScheduleSaveButton";
import { trpc } from "@/server/api/api";
import { event, setup } from "@root/test/helpers/event-ui";

const flush = async (action: () => void) => {
	await act(async () => {
		action();
		await setTimeout(0);
	});
};

const button = (renderer: ReactTestRenderer, eventName: string) => {
	const star = renderer.root
		.findAllByType("button")
		.find(node => typeof node.props["aria-label"] === "string" && node.props["aria-label"].includes(eventName));
	assert.ok(star, `Missing schedule star for ${eventName}`);
	return star;
};

void test("schedule stars update optimistically per event and roll back with an event-specific error", async t => {
	const { requests, queryClient, wrap } = await setup(t);
	const secondEvent = { ...event, id: "event-2", name: "Hardware Workshop", nameFr: "Atelier matériel" };
	queryClient.setQueryData(getQueryKey(trpc.events.savedIds, undefined, "query"), [event.id]);
	const Host = () => {
		const saved = trpc.events.savedIds.useQuery(undefined, { staleTime: Infinity });
		return createElement(
			"div",
			null,
			createElement(ScheduleSaveButton, {
				eventId: event.id,
				eventName: event.name,
				interested: (saved.data ?? []).includes(event.id),
			}),
			createElement(ScheduleSaveButton, {
				eventId: secondEvent.id,
				eventName: secondEvent.name,
				interested: (saved.data ?? []).includes(secondEvent.id),
			}),
		);
	};
	let renderer!: ReactTestRenderer;
	await act(() => {
		renderer = create(wrap(createElement(Host)));
	});
	t.after(() => renderer.unmount());
	await flush(() => undefined);

	const firstStar = button(renderer, event.name);
	const secondStar = button(renderer, secondEvent.name);
	assert.equal(firstStar.props["aria-pressed"], true);
	assert.equal(secondStar.props["aria-pressed"], false);

	const onSecondStarClick: unknown = secondStar.props.onClick;
	assert.equal(typeof onSecondStarClick, "function");
	await flush(() => {
		if (typeof onSecondStarClick === "function") onSecondStarClick();
	});
	assert.equal(requests.length, 1);
	assert.equal(button(renderer, secondEvent.name).props.disabled, true);
	assert.equal(
		button(renderer, event.name).props.disabled,
		false,
		"a different event remains actionable while this request is pending",
	);
	assert.equal(
		button(renderer, secondEvent.name).props["aria-pressed"],
		true,
		"the star reflects the optimistic saved state",
	);

	await flush(() => requests[0]?.fail());
	assert.equal(button(renderer, secondEvent.name).props.disabled, false);
	assert.equal(button(renderer, secondEvent.name).props["aria-pressed"], false, "the failed save is rolled back");
	assert.ok(
		renderer.root.findAllByProps({ role: "alert" }).some(node => node.children.join("").includes(secondEvent.name)),
		"the failure message identifies the event",
	);
});
