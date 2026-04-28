/**
 * Tests for ai-lab-admin-actions.ts server actions (Week 4 Step 10c).
 *
 * Tests 1-2:  approveArchive — DB update + moderation log
 * Test 3:     approveArchive — throws for non-admin
 * Tests 4-7:  editArchiveNarrative — update, empty, too long, not admin
 * Tests 8-9:  regenerateArchive — deletes + queues, throws for non-admin
 * Tests 10-13: rejectArchive — status set, empty reason, not admin, log entry
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Auth mock ────────────────────────────────────────────────────────

const mockRequireAdmin       = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetAuthenticatedId = vi.hoisted(() => vi.fn().mockResolvedValue("admin-user-id"));

vi.mock("@/lib/auth", () => ({
  requireAdmin:           mockRequireAdmin,
  getAuthenticatedUserId: mockGetAuthenticatedId,
}));

// ─── Next.js cache mock ───────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ─── DB mock ─────────────────────────────────────────────────────────

const capturedUpdates:  Array<Record<string, unknown>> = [];
const capturedInserts:  Array<Record<string, unknown>> = [];
let   txDeleted = false;

const mockDbSelect = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    from: () => ({
      where: () => Promise.resolve([{ date: "2026-04-25", id: "arch-1" }]),
    }),
  }))
);

const mockDbUpdate = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    set: (data: Record<string, unknown>) => ({
      where: () => {
        capturedUpdates.push(data);
        return Promise.resolve(undefined);
      },
    }),
  }))
);

const mockDbInsert = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    values: (data: Record<string, unknown>) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    },
  }))
);

const mockDbDelete = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    where: () => {
      txDeleted = true;
      return Promise.resolve(undefined);
    },
  }))
);

const mockTransaction = vi.hoisted(() =>
  vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn().mockImplementation(() => ({
        values: (data: Record<string, unknown>) => {
          capturedInserts.push(data);
          return Promise.resolve(undefined);
        },
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: () => {
          txDeleted = true;
          return Promise.resolve(undefined);
        },
      })),
    };
    return cb(tx);
  })
);

vi.mock("@/db", () => ({
  db: {
    select:      mockDbSelect,
    update:      mockDbUpdate,
    insert:      mockDbInsert,
    delete:      mockDbDelete,
    transaction: mockTransaction,
  },
}));

// ─── Personas mock (for archivist lookup in regenerateArchive) ────────

vi.mock("@/lib/agents/personas", () => ({
  ALL_AGENTS: [
    { id: "ai_archivist", role: "archivist", name: "Archivist", handle: "archivist" },
  ],
}));

import {
  approveArchive,
  editArchiveNarrative,
  regenerateArchive,
  rejectArchive,
} from "@/app/actions/ai-lab-admin-actions";

// ─── Test helpers ─────────────────────────────────────────────────────

function resetState() {
  capturedUpdates.length = 0;
  capturedInserts.length = 0;
  txDeleted = false;
  vi.clearAllMocks();

  mockRequireAdmin.mockResolvedValue(undefined);
  mockGetAuthenticatedId.mockResolvedValue("admin-user-id");

  mockDbSelect.mockImplementation(() => ({
    from: () => ({
      where: () => Promise.resolve([{ date: "2026-04-25", id: "arch-1" }]),
    }),
  }));

  mockDbUpdate.mockImplementation(() => ({
    set: (data: Record<string, unknown>) => ({
      where: () => {
        capturedUpdates.push(data);
        return Promise.resolve(undefined);
      },
    }),
  }));

  mockDbInsert.mockImplementation(() => ({
    values: (data: Record<string, unknown>) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    },
  }));

  mockDbDelete.mockImplementation(() => ({
    where: () => { txDeleted = true; return Promise.resolve(undefined); },
  }));

  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn().mockImplementation(() => ({
        values: (data: Record<string, unknown>) => {
          capturedInserts.push(data);
          return Promise.resolve(undefined);
        },
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: () => { txDeleted = true; return Promise.resolve(undefined); },
      })),
    };
    return cb(tx);
  });
}

// ─── approveArchive ───────────────────────────────────────────────────

describe("approveArchive", () => {
  beforeEach(resetState);

  it("sets status='published' and publishedAt on ai_lab_archives", async () => {
    const result = await approveArchive("arch-1");
    expect(result.success).toBe(true);
    const update = capturedUpdates[0];
    expect(update.status).toBe("published");
    expect(update.publishedAt).toBeInstanceOf(Date);
    expect(update.reviewedByAgentId).toBe("admin-user-id");
  });

  it("creates an ai_moderation_log entry with verdict='approved'", async () => {
    await approveArchive("arch-1");
    const logInsert = capturedInserts.find(
      (i) => (i as { verdict?: string }).verdict === "approved"
    );
    expect(logInsert).toBeDefined();
    expect((logInsert as Record<string, unknown>).moderatorAgentId).toBe("admin-user-id");
    expect((logInsert as Record<string, unknown>).targetId).toBe("arch-1");
  });

  it("throws when caller is not an admin", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Admin access required"));
    await expect(approveArchive("arch-1")).rejects.toThrow("Admin access required");
  });
});

// ─── editArchiveNarrative ─────────────────────────────────────────────

describe("editArchiveNarrative", () => {
  beforeEach(resetState);

  it("updates narrative_arc without changing status", async () => {
    const result = await editArchiveNarrative("arch-1", "New narrative text here.");
    expect(result.success).toBe(true);
    const update = capturedUpdates[0];
    expect(update.narrativeArc).toBe("New narrative text here.");
    expect(update.status).toBeUndefined();
  });

  it("returns error when narrative is empty", async () => {
    const result = await editArchiveNarrative("arch-1", "   ");
    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("returns error when narrative exceeds 5000 characters", async () => {
    const result = await editArchiveNarrative("arch-1", "x".repeat(5001));
    expect(result.success).toBe(false);
    expect(result.error).toContain("5000");
  });

  it("throws when caller is not an admin", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Admin access required"));
    await expect(editArchiveNarrative("arch-1", "Some text")).rejects.toThrow("Admin access required");
  });
});

// ─── regenerateArchive ────────────────────────────────────────────────

describe("regenerateArchive", () => {
  beforeEach(resetState);

  it("deletes the archive row and queues a new archive_day action in a transaction", async () => {
    const result = await regenerateArchive("arch-1");
    expect(result.success).toBe(true);
    expect(txDeleted).toBe(true);
    const queued = capturedInserts.find(
      (i) => (i as { actionType?: string }).actionType === "archive_day"
    );
    expect(queued).toBeDefined();
    expect((queued as Record<string, unknown>).agentId).toBe("ai_archivist");
    expect(((queued as Record<string, unknown>).promptContext as { date: string }).date).toBe("2026-04-25");
  });

  it("throws when caller is not an admin", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Admin access required"));
    await expect(regenerateArchive("arch-1")).rejects.toThrow("Admin access required");
  });
});

// ─── rejectArchive ────────────────────────────────────────────────────

describe("rejectArchive", () => {
  beforeEach(resetState);

  it("sets status='rejected' on ai_lab_archives", async () => {
    const result = await rejectArchive("arch-1", "Fabricated quotes detected");
    expect(result.success).toBe(true);
    const update = capturedUpdates[0];
    expect(update.status).toBe("rejected");
  });

  it("returns error when reason is empty", async () => {
    const result = await rejectArchive("arch-1", "  ");
    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("throws when caller is not an admin", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Admin access required"));
    await expect(rejectArchive("arch-1", "Some reason")).rejects.toThrow("Admin access required");
  });

  it("creates an ai_moderation_log entry with the admin-provided reason", async () => {
    await rejectArchive("arch-1", "Fabricated quotes detected");
    const logInsert = capturedInserts.find(
      (i) => (i as { verdict?: string }).verdict === "rejected"
    );
    expect(logInsert).toBeDefined();
    expect((logInsert as Record<string, unknown>).reason).toBe("Fabricated quotes detected");
  });
});
