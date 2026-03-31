import { describe, expect, it } from "vitest";
import { generateTempPassword } from "../../server/lib/tempPassword";

describe("generateTempPassword", () => {
  it("generates a non-empty password with expected length", () => {
    const pw = generateTempPassword();
    expect(pw.length).toBe(18);
    expect(pw).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("generates different values across calls", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).not.toBe(b);
  });
});

