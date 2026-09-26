import "server-only";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { mkdirSync } from "node:fs";

// Anonymous sessions only: there's no email, password or social login. A
// session is created when someone finishes onboarding and ends on sign out.
mkdirSync(".data", { recursive: true });

const options = {
  database: new Database(".data/auth.db"),
  // nextCookies must be last so server actions can set the session cookie.
  plugins: [anonymous(), nextCookies()],
};

export const auth = betterAuth(options);

/** Creates the tables on first use. Await before the first auth call. */
export const authReady = getMigrations(options).then(({ runMigrations }) => runMigrations());
