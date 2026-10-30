import assert from "node:assert/strict";
import { assertTransition, canTransition, isTerminal } from "../state-machine";
import { InvalidTransitionError } from "../errors";

function testLegalPath() {
  assert.equal(assertTransition("created", "awaiting_dispatch"), "awaiting_dispatch");
  assert.equal(assertTransition("awaiting_dispatch", "assigned"), "assigned");
  assert.equal(assertTransition("assigned", "picked_up"), "picked_up");
  assert.equal(assertTransition("picked_up", "delivered"), "delivered");
  assert.equal(canTransition("assigned", "cancelled"), true);
  assert.equal(canTransition("picked_up", "cancelled"), false);
  assert.equal(isTerminal("delivered"), true);
  assert.equal(isTerminal("cancelled"), true);
}

function testIllegalJump() {
  assert.throws(() => assertTransition("created", "assigned"), InvalidTransitionError);
  assert.throws(() => assertTransition("delivered", "cancelled"), InvalidTransitionError);
  assert.throws(() => assertTransition("picked_up", "assigned"), InvalidTransitionError);
}

testLegalPath();
testIllegalJump();
console.log(JSON.stringify({ ok: true, suite: "delivery-state-machine", tests: 2 }));
