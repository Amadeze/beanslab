import { describe, expect, it, vi } from "vitest";
import { withSerializableRetry, type TransactionLike } from "./transaction-retry";

function prismaError(code: string) {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}

function makeClient(results: Array<unknown | Error>) {
  let invocation = 0;
  const $transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    const result = results[invocation];
    invocation += 1;
    if (result instanceof Error) throw result;
    return callback({});
  });
  return {
    client: {
      $transaction,
      get invocations() {
        return invocation;
      },
    } as unknown as TransactionLike & { invocations: number },
    $transaction,
  };
}

describe("withSerializableRetry", () => {
  it("retries a P2034 once and returns the committed result", async () => {
    const { client, $transaction } = makeClient([
      prismaError("P2034"),
      "committed",
    ]);
    const result = await withSerializableRetry(client, async () => "committed");

    expect(result).toBe("committed");
    expect(client.invocations).toBe(2);
    expect($transaction).toHaveBeenNthCalledWith(1, expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect($transaction).toHaveBeenNthCalledWith(2, expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("stops after maxAttempts when every attempt hits P2034", async () => {
    const { client } = makeClient([
      prismaError("P2034"),
      prismaError("P2034"),
      prismaError("P2034"),
    ]);

    await expect(withSerializableRetry(client, async () => "x")).rejects.toMatchObject({
      code: "P2034",
    });
    expect(client.invocations).toBe(3);
  });

  it("does not retry non-P2034 errors", async () => {
    const { client } = makeClient([new Error("boom")]);

    await expect(withSerializableRetry(client, async () => "x")).rejects.toThrow("boom");
    expect(client.invocations).toBe(1);
  });

  it("stops retrying when a non-P2034 error occurs after a P2034", async () => {
    const { client } = makeClient([prismaError("P2034"), new Error("boom")]);

    await expect(withSerializableRetry(client, async () => "x")).rejects.toThrow("boom");
    expect(client.invocations).toBe(2);
  });

  it("respects a custom maxAttempts", async () => {
    const { client } = makeClient([
      prismaError("P2034"),
      prismaError("P2034"),
      prismaError("P2034"),
    ]);

    await expect(withSerializableRetry(client, async () => "x", 2)).rejects.toMatchObject({
      code: "P2034",
    });
    expect(client.invocations).toBe(2);
  });

  it("commits only the successful attempt (no duplicate writes)", async () => {
    const committed: string[] = [];
    let invocation = 0;
    const $transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      invocation += 1;
      if (invocation === 1) throw prismaError("P2034");
      const value = `attempt-${invocation}`;
      committed.push(value);
      return callback({});
    });

    const result = await withSerializableRetry(
      { $transaction } as unknown as TransactionLike,
      async () => "attempt-2",
    );

    expect(result).toBe("attempt-2");
    expect(committed).toEqual(["attempt-2"]);
    expect(invocation).toBe(2);
  });
});
