import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import JudgingProjectSwitchButton from "@/components/JudgingProjectSwitchButton";

void test("completed project buttons expose a prominent synchronized completion indicator", () => {
	const markup = renderToStaticMarkup(
		<JudgingProjectSwitchButton
			completionLabel="All fields complete"
			isComplete
			isLocalOnly={false}
			isSelected
			onSelect={() => undefined}
			projectName="Example project"
			statusLabel="Complete — synced"
			tableLabel="Table 42"
		/>,
	);

	assert.match(markup, /All fields complete/);
	assert.match(markup, /bg-green-50/);
	assert.match(markup, /aria-pressed="true"/);
	assert.match(markup, /aria-label="Table 42: Example project\. All fields complete\. Complete — synced"/);
});

void test("local-only completion is amber and partial projects show scoring-scope progress", () => {
	const localMarkup = renderToStaticMarkup(
		<JudgingProjectSwitchButton
			completionLabel="Complete locally"
			isComplete
			isLocalOnly
			isSelected={false}
			onSelect={() => undefined}
			projectName="Offline project"
			statusLabel="Unsynced changes on this device"
			tableLabel="Table 7"
		/>,
	);
	const partialMarkup = renderToStaticMarkup(
		<JudgingProjectSwitchButton
			completionLabel="2/3 done"
			isComplete={false}
			isLocalOnly={false}
			isSelected={false}
			onSelect={() => undefined}
			projectName="Partial project"
			statusLabel="Partially completed — synced"
			tableLabel="Table 8"
		/>,
	);

	assert.match(localMarkup, /bg-amber-50/);
	assert.doesNotMatch(localMarkup, /bg-green-50/);
	assert.match(partialMarkup, /2\/3 done/);
	assert.match(partialMarkup, />○</);
});
