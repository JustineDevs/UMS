import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeSalesChannelsForProductUpdate } from "./sales-channel-utils";

test("mergeSalesChannelsForProductUpdate returns undefined when env channel missing", () => {
  assert.equal(mergeSalesChannelsForProductUpdate([{ id: "sc_a" }], undefined), undefined);
});

test("mergeSalesChannelsForProductUpdate adds env id to existing", () => {
  const out = mergeSalesChannelsForProductUpdate(
    [{ id: "sc_existing" }],
    "sc_storefront",
  );
  assert.deepEqual(out, [{ id: "sc_existing" }, { id: "sc_storefront" }]);
});

test("mergeSalesChannelsForProductUpdate dedupes", () => {
  const out = mergeSalesChannelsForProductUpdate(
    [{ id: "sc_x" }, { id: "sc_x" }],
    "sc_x",
  );
  assert.deepEqual(out, [{ id: "sc_x" }]);
});
