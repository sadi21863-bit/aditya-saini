import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock executor and scheduler before importing routes
const mockProcessQueue       = vi.hoisted(() => vi.fn().mockResolvedValue({ processed: 1, failed: 0 }));
const mockQueueThemeSelection = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockQueueDailyIdeas     = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockQueueDailyArchive   = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/agents/executor", () => ({
  processQueue: mockProcessQueue,
}));

vi.mock("@/lib/agents/scheduler", () => ({
  queueThemeSelection: mockQueueThemeSelection,
  queueDailyIdeas:     mockQueueDailyIdeas,
  queueDailyArchive:   mockQueueDailyArchive,
}));

import { POST as tickPOST }      from "@/app/api/cron/agents/tick/route";
import { POST as themePOST }     from "@/app/api/cron/agents/theme/route";
import { POST as seedIdeasPOST } from "@/app/api/cron/agents/seed-ideas/route";
import { POST as archivePOST }   from "@/app/api/cron/agents/archive/route";

// ─── Test helpers ─────────────────────────────────────────────────────

const VALID_SECRET = "test-cron-secret-123";

function makeReq(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers["authorization"] = authHeader;
  return new Request("http://localhost/api/cron/test", {
    method:  "POST",
    headers,
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET     = VALID_SECRET;
  process.env.AI_LAB_ENABLED  = "true";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.AI_LAB_ENABLED;
});

// ─── Auth guard (applies to all routes) ──────────────────────────────

describe("cron auth guard", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await tickPOST(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const res = await tickPOST(makeReq("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when Bearer prefix is omitted", async () => {
    const res = await tickPOST(makeReq(VALID_SECRET));
    expect(res.status).toBe(401);
  });

  it("returns 503 when AI_LAB_ENABLED is not 'true'", async () => {
    process.env.AI_LAB_ENABLED = "false";
    const res = await tickPOST(makeReq(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(503);
  });

  it("returns 503 when AI_LAB_ENABLED is missing entirely", async () => {
    delete process.env.AI_LAB_ENABLED;
    const res = await tickPOST(makeReq(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(503);
  });
});

// ─── /api/cron/agents/tick ────────────────────────────────────────────

describe("POST /api/cron/agents/tick", () => {
  const auth = () => makeReq(`Bearer ${VALID_SECRET}`);

  it("returns 200 with success=true", async () => {
    const res = await tickPOST(auth());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("calls processQueue(5)", async () => {
    await tickPOST(auth());
    expect(mockProcessQueue).toHaveBeenCalledWith(5);
  });

  it("includes processed/failed counts in response", async () => {
    mockProcessQueue.mockResolvedValueOnce({ processed: 3, failed: 1 });
    const res = await tickPOST(auth());
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(body.failed).toBe(1);
  });

  it("returns 500 when processQueue throws", async () => {
    mockProcessQueue.mockRejectedValueOnce(new Error("DB unavailable"));
    const res = await tickPOST(auth());
    expect(res.status).toBe(500);
  });
});

// ─── /api/cron/agents/theme ───────────────────────────────────────────

describe("POST /api/cron/agents/theme", () => {
  const auth = () => makeReq(`Bearer ${VALID_SECRET}`);

  it("returns 200 with success=true and queued field", async () => {
    const res = await themePOST(auth());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.queued).toBe("theme_select");
  });

  it("calls queueThemeSelection", async () => {
    await themePOST(auth());
    expect(mockQueueThemeSelection).toHaveBeenCalledOnce();
  });

  it("returns 500 when queueThemeSelection throws", async () => {
    mockQueueThemeSelection.mockRejectedValueOnce(new Error("DB error"));
    const res = await themePOST(auth());
    expect(res.status).toBe(500);
  });
});

// ─── /api/cron/agents/seed-ideas ─────────────────────────────────────

describe("POST /api/cron/agents/seed-ideas", () => {
  const auth = () => makeReq(`Bearer ${VALID_SECRET}`);

  it("returns 200 with success=true and count=3", async () => {
    const res = await seedIdeasPOST(auth());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(3);
  });

  it("calls queueDailyIdeas", async () => {
    await seedIdeasPOST(auth());
    expect(mockQueueDailyIdeas).toHaveBeenCalledOnce();
  });
});

// ─── /api/cron/agents/archive ─────────────────────────────────────────

describe("POST /api/cron/agents/archive", () => {
  const auth = () => makeReq(`Bearer ${VALID_SECRET}`);

  it("returns 200 with success=true", async () => {
    const res = await archivePOST(auth());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.queued).toBe("archive_day");
  });

  it("calls queueDailyArchive", async () => {
    await archivePOST(auth());
    expect(mockQueueDailyArchive).toHaveBeenCalledOnce();
  });
});
