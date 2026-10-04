import { describe, expect, it } from "vitest";
import { listGoodMemoryValues, rememberGoodMemoryValue } from "./memory";

describe("good memory adapter", () => {
  it("does not replace localStorage or IndexedDB when Supabase is not configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(listGoodMemoryValues("good_conduct_certificates", "fullNameAr")).resolves.toEqual({ data: [], source: "fallback" });
    await expect(rememberGoodMemoryValue({ moduleKey: "good_conduct_certificates", fieldKey: "fullNameAr", value: "Test" })).resolves.toEqual({ data: null, source: "fallback" });
  });
});
