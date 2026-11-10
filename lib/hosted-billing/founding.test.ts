import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  cancelBillableSubscriptions,
  cancelSubscriptionNow,
} from "./founding";

function fakeStripe(opts: {
  subs?: { id: string; status: Stripe.Subscription.Status }[];
  cancel?: (id: string) => Promise<unknown>;
}) {
  const cancel = vi.fn(opts.cancel ?? (async () => ({})));
  const list = vi.fn(() => {
    const subs = opts.subs ?? [];
    return {
      async *[Symbol.asyncIterator]() {
        yield* subs;
      },
    };
  });
  return {
    stripe: { subscriptions: { cancel, list } } as unknown as Pick<
      Stripe,
      "subscriptions"
    >,
    cancel,
    list,
  };
}

describe("cancelSubscriptionNow", () => {
  it("cancels the subscription", async () => {
    const { stripe, cancel } = fakeStripe({});
    await expect(cancelSubscriptionNow(stripe, "sub_1")).resolves.toBe(
      "cancelled"
    );
    expect(cancel).toHaveBeenCalledWith("sub_1");
  });

  it("treats an already-cancelled or missing subscription as done", async () => {
    for (const err of [
      { code: "resource_missing", message: "No such subscription" },
      { message: "This subscription has already been canceled." },
    ]) {
      const { stripe } = fakeStripe({
        cancel: async () => {
          throw err;
        },
      });
      await expect(cancelSubscriptionNow(stripe, "sub_1")).resolves.toBe(
        "already_gone"
      );
    }
  });

  it("rethrows other errors so the webhook fails and Stripe retries", async () => {
    const { stripe } = fakeStripe({
      cancel: async () => {
        throw { code: "rate_limit", message: "Too many requests" };
      },
    });
    await expect(cancelSubscriptionNow(stripe, "sub_1")).rejects.toMatchObject({
      code: "rate_limit",
    });
  });
});

describe("cancelBillableSubscriptions", () => {
  it("cancels only subscriptions that can still bill", async () => {
    const { stripe, cancel, list } = fakeStripe({
      subs: [
        { id: "sub_active", status: "active" },
        { id: "sub_past_due", status: "past_due" },
        { id: "sub_done", status: "canceled" },
        { id: "sub_expired", status: "incomplete_expired" },
      ],
    });
    await expect(cancelBillableSubscriptions(stripe, "cus_1")).resolves.toEqual(
      ["sub_active", "sub_past_due"]
    );
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", status: "all" })
    );
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
