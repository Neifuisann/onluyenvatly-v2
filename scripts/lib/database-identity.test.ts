import { expect, it } from "vitest";
import { databaseIdentity } from "./database-identity";

it("identifies the same Supabase project across roles, hosts and pooler ports", () => {
  const expected = databaseIdentity(
    "postgres://postgres:test@db.source.supabase.co/postgres",
  );
  for (const url of [
    "postgres://postgres.source:test@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    "postgres://readonly.source:test@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ])
    expect(databaseIdentity(url)).toBe(expected);
});
it("distinguishes projects sharing one pooler and databases on one server", () => {
  expect(
    databaseIdentity(
      "postgres://postgres.source:test@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ),
  ).not.toBe(
    databaseIdentity(
      "postgres://postgres.target:test@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ),
  );
  expect(databaseIdentity("postgres://user:test@localhost/db1")).not.toBe(
    databaseIdentity("postgres://user:test@127.0.0.1/db2"),
  );
});
it("normalizes Neon pooler and local aliases and refuses ambiguous Supabase roles", () => {
  expect(
    databaseIdentity(
      "postgres://user:test@ep-test-pooler.ap-southeast-1.aws.neon.tech/db",
    ),
  ).toBe(
    databaseIdentity(
      "postgres://user:test@ep-test.ap-southeast-1.aws.neon.tech/db",
    ),
  );
  expect(databaseIdentity("postgres://user:test@localhost/db")).toBe(
    databaseIdentity("postgres://user:test@127.0.0.1:5432/db"),
  );
  expect(() =>
    databaseIdentity(
      "postgres://postgres:test@aws-0-ap-southeast-1.pooler.supabase.com/db",
    ),
  ).toThrow();
});
