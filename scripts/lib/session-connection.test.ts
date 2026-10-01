import { describe, expect, it } from "vitest";
import { sessionConnection } from "./session-connection";

describe("CI session connection", () => {
  it("preserves the target project and encoded credentials", () => {
    const url = new URL(
      sessionConnection(
        "postgres://postgres:p%40ss@db.targetref.supabase.co:5432/postgres",
        "aws-0-ap-southeast-1.pooler.supabase.com",
      ),
    );
    expect(url.username).toBe("postgres.targetref");
    expect(url.password).toBe("p%40ss");
    expect(url.port).toBe("5432");
    expect(url.searchParams.get("sslmode")).toBe("require");
  });
  it("leaves configured session, Neon and local URLs unchanged", () => {
    for (const url of [
      "postgres://postgres.ref:test@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
      "postgres://test:test@staging.neon.tech/db",
      "postgres://test:test@localhost/db",
    ])
      expect(sessionConnection(url, "unused")).toBe(url);
  });
  it("refuses other destinations and custom role rewriting", () => {
    expect(() =>
      sessionConnection(
        "postgres://postgres:test@db.ref.supabase.co/db",
        "example.com",
      ),
    ).toThrow();
    expect(() =>
      sessionConnection(
        "postgres://custom:test@db.ref.supabase.co/db",
        "aws-0-ap-southeast-1.pooler.supabase.com",
      ),
    ).toThrow();
  });
});
