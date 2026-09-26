import { toNextJsHandler } from "better-auth/next-js";
import { auth, authReady } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export async function GET(req: Request) {
  await authReady;
  return handler.GET(req);
}

export async function POST(req: Request) {
  await authReady;
  return handler.POST(req);
}
