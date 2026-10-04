import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listGoodMemoryValues, rememberGoodMemoryValue } from "./memory";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_COOKIE = "good_conduct_access";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

type LoginAttemptState = {
  count: number;
  firstAttemptAt: number;
  lastBlockedLogAt?: number;
};

const failedLoginAttempts = new Map<string, LoginAttemptState>();

function getSessionSecret() {
  return process.env.SITE_SESSION_SECRET || "local-development-session-secret";
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

function hasValidSession(req: Request) {
  const raw = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (!raw) return false;

  const [expiresAt, signature] = raw.split(".");
  if (!expiresAt || !signature || Number(expiresAt) < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = sign(expiresAt);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function passwordsMatch(input: string) {
  const configuredPassword = process.env.SITE_PASSWORD;
  if (!configuredPassword || !input) return false;

  const left = Buffer.from(input);
  const right = Buffer.from(configuredPassword);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function getClientKey(req: Request) {
  const normalizedIp = req.ip || "unknown";
  return crypto
    .createHash("sha256")
    .update(`${getSessionSecret()}:${normalizedIp}`)
    .digest("hex")
    .slice(0, 16);
}

function logSecurityEvent(
  event: "login_failed" | "login_blocked" | "login_success" | "login_config_missing",
  req: Request,
  details: Record<string, string | number>,
) {
  console.warn(
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ipHash: getClientKey(req),
      ...details,
    }),
  );
}

function getLoginState(req: Request) {
  const key = getClientKey(req);
  const current = failedLoginAttempts.get(key);
  const now = Date.now();

  if (!current || now - current.firstAttemptAt >= LOGIN_WINDOW_MS) {
    failedLoginAttempts.delete(key);
    return { key, now, state: undefined as LoginAttemptState | undefined };
  }

  return { key, now, state: current };
}

function isLoginBlocked(req: Request) {
  const { state, now } = getLoginState(req);
  if (!state || state.count < LOGIN_MAX_ATTEMPTS) return false;

  if (!state.lastBlockedLogAt || now - state.lastBlockedLogAt >= 60_000) {
    state.lastBlockedLogAt = now;
    logSecurityEvent("login_blocked", req, {
      attempts: state.count,
      retryAfterSeconds: Math.ceil((state.firstAttemptAt + LOGIN_WINDOW_MS - now) / 1000),
    });
  }

  return true;
}

function recordFailedLogin(req: Request, reason: "invalid_password" | "missing_password") {
  const { key, now, state } = getLoginState(req);
  const nextState = state || { count: 0, firstAttemptAt: now };
  nextState.count += 1;
  failedLoginAttempts.set(key, nextState);

  logSecurityEvent("login_failed", req, {
    reason,
    attempt: nextState.count,
  });
}

function clearFailedLogins(req: Request) {
  failedLoginAttempts.delete(getClientKey(req));
}

function setSessionCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${createSessionToken()}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

function clearSessionCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`,
  );
}

function redirectToLogin(req: Request, res: Response, next: NextFunction) {
  if (hasValidSession(req)) {
    next();
    return;
  }

  if (req.path.startsWith("/api/")) {
    res.status(401).json({ authenticated: false, message: "يلزم تسجيل الدخول" });
    return;
  }

  res.redirect(`/login?next=${encodeURIComponent(req.path)}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const staticPath = path.resolve(__dirname, "public");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/session", (req, res) => {
    res.json({ authenticated: hasValidSession(req) });
  });

  app.post("/api/login", (req, res) => {
    if (isLoginBlocked(req)) {
      const { state, now } = getLoginState(req);
      const retryAfterSeconds = state
        ? Math.max(1, Math.ceil((state.firstAttemptAt + LOGIN_WINDOW_MS - now) / 1000))
        : 60;
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ message: "تم إيقاف المحاولات مؤقتًا. حاول بعد قليل" });
      return;
    }

    if (!process.env.SITE_PASSWORD) {
      logSecurityEvent("login_config_missing", req, {});
      res.status(503).json({ message: "لم يتم إعداد كلمة المرور على الخادم بعد" });
      return;
    }

    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!passwordsMatch(password)) {
      recordFailedLogin(req, password ? "invalid_password" : "missing_password");
      res.status(401).json({ message: "كلمة المرور غير صحيحة" });
      return;
    }

    clearFailedLogins(req);
    logSecurityEvent("login_success", req, {});
    setSessionCookie(res);
    res.json({ authenticated: true });
  });

  app.post("/api/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ authenticated: false });
  });

  app.get("/api/memory", redirectToLogin, async (req, res) => {
    const moduleKey = typeof req.query.moduleKey === "string" ? req.query.moduleKey : "";
    const fieldKey = typeof req.query.fieldKey === "string" ? req.query.fieldKey : undefined;
    const parsedLimit = Number(req.query.limit ?? 120);
    if (!moduleKey || moduleKey.length > 80 || (fieldKey && fieldKey.length > 80) || !Number.isInteger(parsedLimit)) {
      res.status(400).json({ message: "بيانات طلب الذاكرة غير صالحة" });
      return;
    }
    const result = await listGoodMemoryValues(moduleKey, fieldKey, Math.min(Math.max(parsedLimit, 1), 200));
    res.json({ values: result.data, source: result.source });
  });

  app.post("/api/memory", redirectToLogin, async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const moduleKey = typeof body.moduleKey === "string" ? body.moduleKey : "";
    const fieldKey = typeof body.fieldKey === "string" ? body.fieldKey : "";
    const value = typeof body.value === "string" ? body.value : "";
    if (!moduleKey || moduleKey.length > 80 || !fieldKey || fieldKey.length > 80 || value.length > 500) {
      res.status(400).json({ message: "بيانات الذاكرة غير صالحة" });
      return;
    }
    const result = await rememberGoodMemoryValue({
      moduleKey,
      fieldKey,
      value,
      labelAr: typeof body.labelAr === "string" ? body.labelAr.slice(0, 500) : undefined,
      labelEn: typeof body.labelEn === "string" ? body.labelEn.slice(0, 500) : undefined,
    });
    res.json({ value: result.data, source: result.source });
  });

  app.use(express.static(staticPath));

  app.get(["/editor", "/preview", "/records"], redirectToLogin, (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  app.get(["/", "/login"], (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  app.use(redirectToLogin);
  app.use((_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
