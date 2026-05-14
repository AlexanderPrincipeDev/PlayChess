import test from "node:test";
import assert from "node:assert/strict";
import { capturedMaterial } from "../src/chess/material.js";

test("calcula capturas y balance material", () => {
  const material = capturedMaterial([
    { color: "w", captured: "p" },
    { color: "b", captured: "n" },
    { color: "w", captured: "r" },
  ]);

  assert.deepEqual(material.whiteCaptured, ["p", "r"]);
  assert.deepEqual(material.blackCaptured, ["n"]);
  assert.equal(material.balance, 3);
});
