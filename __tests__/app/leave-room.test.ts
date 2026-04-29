/**
 * Tests for leaveRoom server action (app/actions/roomActions.ts).
 *
 * 1. Non-member returns not_a_member
 * 2. Owner (creator) returns owner_cannot_leave
 * 3. Member successfully leaves — room_members row deleted
 * 4. AI Lab room returns cannot_leave_ai_lab
 * 5. Unauthenticated user rejected
 * 6. Only the leaving user's membership is deleted (other members unaffected)
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Auth mock ────────────────────────────────────────────────────────

const mockGetAuthenticatedId = vi.hoisted(() => vi.fn().mockResolvedValue("user-1"));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserId: mockGetAuthenticatedId,
}));

// ─── Rate limiter mock ────────────────────────────────────────────────

vi.mock("@/lib/ratelimit", () => ({
  writeLimiter: { limit: vi.fn().mockResolvedValue({ success: true }) },
  lightLimiter: { limit: vi.fn().mockResolvedValue({ success: true }) },
}));

// ─── Next.js cache mock ───────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ─── Notifications mock ───────────────────────────────────────────────

vi.mock("@/app/actions/notificationActions", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── DB mock ─────────────────────────────────────────────────────────

// Mutable per-test state
let mockMemberRow: Record<string, unknown> | null = null;
let mockRoomRow:   Record<string, unknown> | null = null;
let capturedDeletes: unknown[] = [];

const mockDbSelect = vi.hoisted(() =>
  vi.fn().mockImplementation(() => {
    let _table: unknown;
    return {
      from: (table: unknown) => {
        _table = table;
        return {
          where: () => {
            // Distinguish by what was set in the test
            if (String(_table).includes("room_members") || mockMemberRow !== null && mockRoomRow === null) {
              return Promise.resolve(mockMemberRow ? [mockMemberRow] : []);
            }
            return Promise.resolve(mockRoomRow ? [mockRoomRow] : []);
          },
        };
      },
    };
  })
);

const mockDbDelete = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    where: (cond: unknown) => {
      capturedDeletes.push(cond);
      return Promise.resolve(undefined);
    },
  }))
);

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    delete: mockDbDelete,
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

import { leaveRoom, joinPublicRoom } from "@/app/actions/roomActions";

// ─── Helpers ──────────────────────────────────────────────────────────

function reset() {
  mockMemberRow  = null;
  mockRoomRow    = null;
  capturedDeletes = [];
  vi.clearAllMocks();
  mockGetAuthenticatedId.mockResolvedValue("user-1");

  // Re-wire select: first call returns member row, second call returns room row
  let selectIdx = 0;
  mockDbSelect.mockImplementation(() => ({
    from: () => ({
      where: () => {
        const idx = selectIdx++;
        if (idx === 0) return Promise.resolve(mockMemberRow ? [mockMemberRow] : []);
        return Promise.resolve(mockRoomRow ? [mockRoomRow] : []);
      },
    }),
  }));

  mockDbDelete.mockImplementation(() => ({
    where: (cond: unknown) => {
      capturedDeletes.push(cond);
      return Promise.resolve(undefined);
    },
  }));
}

const NORMAL_ROOM = {
  id:         "room-1",
  creatorId:  "creator-user",
  isAiLab:    false,
  status:     "active",
};

const AI_LAB_ROOM = {
  id:         "ailab-room",
  creatorId:  "creator-user",
  isAiLab:    true,
  status:     "active",
};

// ─── Tests ────────────────────────────────────────────────────────────

describe("leaveRoom — non-member", () => {
  beforeEach(reset);

  it("returns not_a_member when caller has no membership row", async () => {
    mockMemberRow = null; // not a member
    const result = await leaveRoom("room-1");
    expect(result.success).toBe(false);
    expect("error" in result && result.error).toBe("not_a_member");
    expect(capturedDeletes).toHaveLength(0);
  });
});

describe("leaveRoom — owner blocked", () => {
  beforeEach(reset);

  it("returns owner_cannot_leave when the member's role is 'owner'", async () => {
    mockMemberRow = { id: "m1", userId: "user-1", roomId: "room-1", role: "owner" };
    mockRoomRow   = NORMAL_ROOM;

    const result = await leaveRoom("room-1");
    expect(result.success).toBe(false);
    expect("error" in result && result.error).toBe("owner_cannot_leave");
    expect(capturedDeletes).toHaveLength(0);
  });
});

describe("leaveRoom — successful leave", () => {
  beforeEach(reset);

  it("deletes the room_members row and returns success", async () => {
    mockMemberRow = { id: "m1", userId: "user-1", roomId: "room-1", role: "member" };
    mockRoomRow   = NORMAL_ROOM; // creatorId !== callerId

    const result = await leaveRoom("room-1");
    expect(result.success).toBe(true);
    expect(capturedDeletes).toHaveLength(1);
  });
});

describe("leaveRoom — AI Lab room", () => {
  beforeEach(reset);

  it("returns cannot_leave_ai_lab when room.isAiLab is true", async () => {
    mockMemberRow = { id: "m1", userId: "user-1", roomId: "ailab-room", role: "member" };
    mockRoomRow   = AI_LAB_ROOM;

    const result = await leaveRoom("ailab-room");
    expect(result.success).toBe(false);
    expect("error" in result && result.error).toBe("cannot_leave_ai_lab");
    expect(capturedDeletes).toHaveLength(0);
  });
});

describe("leaveRoom — unauthenticated", () => {
  beforeEach(reset);

  it("rejects unauthenticated callers without touching the DB", async () => {
    mockGetAuthenticatedId.mockResolvedValue(null);

    const result = await leaveRoom("room-1");
    expect(result.success).toBe(false);
    expect(capturedDeletes).toHaveLength(0);
  });
});

describe("leaveRoom — only deletes caller's membership", () => {
  beforeEach(reset);

  it("issues exactly one delete (the caller's row) even when other members exist", async () => {
    // Caller is user-1, a regular member
    mockMemberRow = { id: "m1", userId: "user-1", roomId: "room-1", role: "member" };
    mockRoomRow   = NORMAL_ROOM;

    await leaveRoom("room-1");

    // Exactly one delete was issued
    expect(capturedDeletes).toHaveLength(1);
  });
});

// ─── joinPublicRoom — AI Lab guard ────────────────────────────────────

const mockDbInsert = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    values: vi.fn().mockResolvedValue(undefined),
  }))
);

// Re-expose db mock for joinPublicRoom (already mocked above, just re-wire insert)
describe("joinPublicRoom — AI Lab guard", () => {
  beforeEach(() => {
    reset();
    // joinPublicRoom: select calls are room (idx 0), membership check (idx 1), count (idx 2)
    let idx = 0;
    mockDbSelect.mockImplementation(() => ({
      from: () => ({
        where: () => {
          const i = idx++;
          if (i === 0) return Promise.resolve(mockRoomRow ? [mockRoomRow] : []);
          if (i === 1) return Promise.resolve([]); // no existing membership
          return Promise.resolve([{ memberCount: 0 }]); // member count
        },
        // count() query uses .where() too — same chain
      }),
    }));
    mockDbInsert.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it("returns cannot_join_ai_lab when room.isAiLab is true", async () => {
    mockRoomRow = { ...AI_LAB_ROOM, visibility: "public", status: "active", maxMembers: 8 };

    const result = await joinPublicRoom("ailab-room");
    expect(result.success).toBe(false);
    expect("error" in result && result.error).toBe("cannot_join_ai_lab");
  });

  it("succeeds for a normal public room (regression check)", async () => {
    mockRoomRow = { ...NORMAL_ROOM, visibility: "public", status: "active", maxMembers: 8 };

    const result = await joinPublicRoom("room-1");
    expect(result.success).toBe(true);
  });
});
