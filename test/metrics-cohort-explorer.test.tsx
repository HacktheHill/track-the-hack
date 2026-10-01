import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import i18next from "i18next";
import { z } from "zod";
import { CohortExplorer } from "@/components/metrics/CohortExplorer";

void test("cohort selection, expanded categories and display survive a data-only refresh", async t => {
	const i18n = i18next.createInstance();
	await i18n.init({ lng: "en", resources: { en: { translation: {} } } });
	const dimensions = {
		school: Array.from({ length: 12 }, (_, index) => ({
			label: `School ${index}`,
			applicants: 20,
			accepted: 10,
			confirmed: 6,
			attended: index,
		})),
		country: [{ label: "Canada", applicants: 4, accepted: 3, confirmed: 2, attended: 1 }],
	};
	let renderer: ReactTestRenderer | undefined;
	await act(() => {
		renderer = create(createElement(CohortExplorer, { dimensions, t: i18n.t }));
	});
	assert.ok(renderer);
	const rendered = renderer;
	t.after(() => rendered.unmount());
	assert.equal(rendered.root.findAllByType("select")[1]?.props.value, "attended");
	assert.equal(rendered.root.findAllByType("li").length, 10);
	const change = (index: number, value: string) =>
		z
			.function()
			.args(z.object({ target: z.object({ value: z.string() }) }))
			.returns(z.void())
			.parse(rendered.root.findAllByType("select")[index]?.props.onChange)({ target: { value } });
	await act(() => z.function().args().returns(z.void()).parse(rendered.root.findByType("button").props.onClick)());
	await act(() => change(1, "accepted"));
	await act(() =>
		rendered.update(createElement(CohortExplorer, { dimensions: structuredClone(dimensions), t: i18n.t })),
	);
	assert.equal(rendered.root.findAllByType("select")[1]?.props.value, "accepted");
	assert.equal(rendered.root.findAllByType("li").length, 12);
	await act(() => change(2, "conversion"));
	await act(() =>
		rendered.update(createElement(CohortExplorer, { dimensions: structuredClone(dimensions), t: i18n.t })),
	);
	assert.equal(rendered.root.findAllByType("select")[2]?.props.value, "conversion");
	assert.ok(JSON.stringify(rendered.toJSON()).includes("50% (10/20)"));
	await act(() => change(0, "country"));
	assert.ok(!JSON.stringify(rendered.toJSON()).includes("75%"), "small denominators are not given conversion rates");
});

void test("metrics refresh requests data without navigation or replacing the loaded dashboard", () => {
	const source = readFileSync(new URL("../src/pages/metrics/index.tsx", import.meta.url), "utf8");
	assert.match(source, /onRefresh=\{\(\) => void query\.refetch\(\)\}/);
	assert.match(source, /refetchInterval: 30_000/);
	assert.match(source, /!query\.data && query\.isLoading/);
	assert.doesNotMatch(source, /location\.|router\.(reload|replace|push)|key=\{query\.dataUpdatedAt/);
});

void test("paired cohort comparison keeps separate population denominators and falls back for overlapping channels", async t => {
	const i18n = i18next.createInstance();
	await i18n.init({ lng: "en", resources: { en: { translation: {} } } });
	const dimensions = {
		school: [
			{ label: "School A", applicants: 20, accepted: 10, confirmed: 5, attended: 5 },
			{ label: "School B", applicants: 80, accepted: 30, confirmed: 10, attended: 5 },
		],
		acquisitionChannel: [{ label: "Friends", applicants: 70, accepted: 40, confirmed: 20, attended: 10 }],
	};
	let renderer: ReactTestRenderer | undefined;
	await act(() => {
		renderer = create(createElement(CohortExplorer, { dimensions, t: i18n.t }));
	});
	assert.ok(renderer);
	const rendered = renderer;
	t.after(() => rendered.unmount());
	const change = (index: number, value: string) =>
		z
			.function()
			.args(z.object({ target: z.object({ value: z.string() }) }))
			.returns(z.void())
			.parse(rendered.root.findAllByType("select")[index]?.props.onChange)({ target: { value } });
	await act(() => change(2, "comparison"));
	assert.ok(rendered.root.findByType("h2").children.includes("comparisonView"));
	assert.ok(JSON.stringify(rendered.toJSON()).includes("20%"));
	assert.ok(JSON.stringify(rendered.toJSON()).includes("50%"));
	await act(() =>
		rendered.update(createElement(CohortExplorer, { dimensions: structuredClone(dimensions), t: i18n.t })),
	);
	assert.equal(rendered.root.findAllByType("select")[2]?.props.value, "comparison");
	await act(() => change(0, "acquisitionChannel"));
	assert.equal(rendered.root.findAllByType("select")[2]?.props.value, "counts");
});

void test("cohort charts separate answer coverage and omit zeros without losing exact counts", async t => {
	const i18n = i18next.createInstance();
	await i18n.init({ lng: "en", resources: { en: { translation: {} } } });
	const row = (label: string, attended: number) => ({ label, applicants: 20, accepted: 10, confirmed: 6, attended });
	const dimensions = {
		school: [row("School A", 8), row("School B", 0), row("Not provided", 7), row("Other / suppressed", 3)],
	};
	let renderer: ReactTestRenderer | undefined;
	await act(() => {
		renderer = create(createElement(CohortExplorer, { dimensions, t: i18n.t }));
	});
	assert.ok(renderer);
	const rendered = renderer;
	t.after(() => rendered.unmount());
	assert.equal(rendered.root.findAllByType("li").length, 1);
	assert.ok(
		rendered.root
			.findByType("li")
			.findAllByType("span")
			.some(span => span.children.includes("School A")),
	);
	assert.equal(rendered.root.findAllByType("aside").length, 1);
	assert.equal(rendered.root.findByType("tbody").findAllByType("tr").length, 4);
	assert.ok(
		rendered.root
			.findByType("tbody")
			.findAllByType("th")
			.some(cell => cell.children.includes("School B")),
	);
	await act(() =>
		z
			.function()
			.args(z.object({ target: z.object({ value: z.string() }) }))
			.returns(z.void())
			.parse(rendered.root.findAllByType("select")[2]?.props.onChange)({ target: { value: "conversion" } }),
	);
	assert.ok(JSON.stringify(rendered.toJSON()).includes("50% (10/20)"));
	const suppressed = rendered.root
		.findByType("tbody")
		.findAllByType("tr")
		.find(entry => entry.findByType("th").children.includes("Other / suppressed"));
	assert.ok(suppressed);
	assert.deepEqual(
		suppressed.findAllByType("td").map(cell => cell.children),
		[["—"], ["—"], ["—"]],
	);
});
