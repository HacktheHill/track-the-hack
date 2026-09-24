import assert from "node:assert/strict";
import test from "node:test";
import { modalFocusTarget } from "@/utils/modal-focus";

void test("notification confirmation dialogs contain forward and reverse keyboard focus", () => {
	const cancel = { id: "cancel" };
	const confirm = { id: "confirm" };
	const elements = [cancel, confirm];

	assert.equal(modalFocusTarget(elements, confirm, false), cancel);
	assert.equal(modalFocusTarget(elements, cancel, true), confirm);
	assert.equal(modalFocusTarget(elements, cancel, false), null);
	assert.equal(modalFocusTarget(elements, { id: "outside" }, false), cancel);
	assert.equal(modalFocusTarget(elements, { id: "outside" }, true), confirm);
	assert.equal(modalFocusTarget([], null, false), null);
});
