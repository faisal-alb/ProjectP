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

/**
 * Creates the tables on first use. Await before the first auth call.
 *
 * `next build` runs several workers against the same fresh database, and the
 * ones that lose the race find the tables already created. Check again and
 * only fail if something is still missing.
 */
export const authReady = (async () => {
  try {
    await (await getMigrations(options)).runMigrations();
  } catch (error) {
    const { toBeCreated, toBeAdded } = await getMigrations(options);
    if (toBeCreated.length || toBeAdded.length) throw error;
  }
})();
