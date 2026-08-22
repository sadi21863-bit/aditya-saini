import { describe, it, expect } from "vitest";
import { ALL_AGENTS, getAdmins, getParticipants } from "@/lib/agents/personas";

describe("personas — ALL_AGENTS structure", () => {
  it("has exactly 9 agents (2 admin + 4 participant + 1 conductor + 1 archivist + 1 research)", () => {
    expect(ALL_AGENTS).toHaveLength(9);
  });

  it("every agent has all required fields", () => {
    const requiredFields = [
      "id", "name", "handle", "provider", "model",
      "role", "persona", "dailyLimit", "avatar",
    ] as const;

    for (const agent of ALL_AGENTS) {
      for (const field of requiredFields) {
        expect(agent[field], `${agent.id} is missing "${field}"`).toBeDefined();
        expect(agent[field], `${agent.id}.${field} is empty`).not.toBe("");
      }
    }
  });

  it("no duplicate handles", () => {
    const handles = ALL_AGENTS.map((a) => a.handle);
    const uniqueHandles = new Set(handles);
    expect(uniqueHandles.size).toBe(handles.length);
  });

  it("no duplicate ids", () => {
    const ids = ALL_AGENTS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("provider is 'groq', 'cerebras', or 'github' for every agent", () => {
    for (const agent of ALL_AGENTS) {
      expect(["groq", "cerebras", "github"]).toContain(agent.provider);
    }
  });

  it("dailyLimit is a positive integer for every agent", () => {
    for (const agent of ALL_AGENTS) {
      expect(typeof agent.dailyLimit).toBe("number");
      expect(Number.isInteger(agent.dailyLimit)).toBe(true);
      expect(agent.dailyLimit).toBeGreaterThan(0);
    }
  });
});

describe("personas — admin tier", () => {
  it("getAdmins returns exactly 2 agents", () => {
    expect(getAdmins()).toHaveLength(2);
  });

  it("admin agents are Theme Setter and Quality Checker", () => {
    const roles = getAdmins().map((a) => a.role).sort();
    expect(roles).toEqual(["quality_checker", "theme_setter"]);
  });

  it("admin agents use Groq as provider", () => {
    for (const agent of getAdmins()) {
      expect(agent.provider).toBe("groq");
    }
  });

  it("admin agents use the adminReasoning model (openai/gpt-oss-120b default)", () => {
    const expectedModel = process.env.AGENT_MODEL_ADMIN ?? "openai/gpt-oss-120b";
    for (const agent of getAdmins()) {
      expect(agent.model).toBe(expectedModel);
    }
  });
});

describe("personas — participant tier", () => {
  it("getParticipants returns exactly 4 agents", () => {
    expect(getParticipants()).toHaveLength(4);
  });

  it("participants are Llama (groq), GPT-OSS (groq), Scout (groq), Maverick (groq)", () => {
    const participants  = getParticipants();
    const llamaAgent    = participants.find((a) => a.handle === "llama");
    const gptOssAgent   = participants.find((a) => a.handle === "gpt-oss");
    const scoutAgent    = participants.find((a) => a.handle === "scout");
    const maverickAgent = participants.find((a) => a.handle === "maverick");

    expect(llamaAgent).toBeDefined();
    expect(gptOssAgent).toBeDefined();
    expect(scoutAgent).toBeDefined();
    expect(maverickAgent).toBeDefined();

    expect(llamaAgent!.provider).toBe("groq");
    expect(gptOssAgent!.provider).toBe("groq");
    expect(scoutAgent!.provider).toBe("groq");
    expect(maverickAgent!.provider).toBe("groq");
  });

  it("every participant persona contains the BRUTAL_HONESTY_RULE markers", () => {
    for (const agent of getParticipants()) {
      expect(agent.persona, `${agent.handle} is missing sycophancy ban`).toContain(
        "NEVER begin a response with"
      );
      expect(agent.persona, `${agent.handle} is missing privacy rule`).toContain(
        "UNIVERSAL PRIVACY RULE"
      );
    }
  });

  it("Llama uses openai/gpt-oss-120b model", () => {
    const llama = getParticipants().find((a) => a.handle === "llama")!;
    const expected = process.env.AGENT_MODEL_LLAMA ?? "openai/gpt-oss-120b";
    expect(llama.model).toBe(expected);
  });

  it("GPT-OSS uses openai/gpt-oss-120b model", () => {
    const gptOss = getParticipants().find((a) => a.handle === "gpt-oss")!;
    const expected = process.env.AGENT_MODEL_GPTOSS ?? "openai/gpt-oss-120b";
    expect(gptOss.model).toBe(expected);
  });

  it("Scout uses openai/gpt-oss-120b model (migrated from retired llama-3.3 2026-08-22)", () => {
    const scout = getParticipants().find((a) => a.handle === "scout")!;
    const expected = process.env.AGENT_MODEL_SCOUT ?? "openai/gpt-oss-120b";
    expect(scout.model).toBe(expected);
  });

  it("Maverick uses openai/gpt-oss-20b model (migrated from GitHub Models 2026-08-07)", () => {
    const maverick = getParticipants().find((a) => a.handle === "maverick")!;
    const expected = process.env.AGENT_MODEL_MAVERICK ?? "openai/gpt-oss-20b";
    expect(maverick.model).toBe(expected);
  });
});

describe("personas — archivist tier", () => {
  it("exactly 1 archivist exists", () => {
    const archivists = ALL_AGENTS.filter((a) => a.role === "archivist");
    expect(archivists).toHaveLength(1);
  });

  it("Archivist uses Groq as provider (migrated from GitHub Models 2026-08-07)", () => {
    const archivist = ALL_AGENTS.find((a) => a.role === "archivist")!;
    expect(archivist.provider).toBe("groq");
  });

  it("Archivist uses openai/gpt-oss-120b model (migrated from openai/gpt-4o 2026-08-07)", () => {
    const archivist = ALL_AGENTS.find((a) => a.role === "archivist")!;
    const expected = process.env.AGENT_MODEL_ARCHIVIST ?? "openai/gpt-oss-120b";
    expect(archivist.model).toBe(expected);
  });

  it("Archivist has maxTokens set to 4000 for GPT-OSS reasoning budget", () => {
    const archivist = ALL_AGENTS.find((a) => a.role === "archivist")!;
    expect(archivist.maxTokens).toBe(4000);
  });

  it("Archivist is NOT in getParticipants()", () => {
    const archivist = ALL_AGENTS.find((a) => a.role === "archivist")!;
    expect(getParticipants()).not.toContainEqual(archivist);
  });
});

describe("personas — Phase 3 agents", () => {
  it("Conductor agent exists with role=conductor and provider=groq (migrated from GitHub Models 2026-08-07)", () => {
    const conductor = ALL_AGENTS.find((a) => a.role === "conductor");
    expect(conductor).toBeDefined();
    expect(conductor!.provider).toBe("groq");
    expect(conductor!.id).toBe("ai_conductor");
  });

  it("no Research Delegator agent exists (permanently deferred — @research handles this)", () => {
    const delegator = ALL_AGENTS.find((a) => a.role === ("research_delegator" as string));
    expect(delegator).toBeUndefined();
  });

  it("no DeepSeek agent exists (not available on free tier)", () => {
    const deepseek = ALL_AGENTS.find((a) => a.handle.toLowerCase().includes("deepseek"));
    expect(deepseek).toBeUndefined();
  });

  it("no Mistral agent exists (removed in v4.2)", () => {
    const mistral = ALL_AGENTS.find((a) => a.handle.toLowerCase().includes("mistral"));
    expect(mistral).toBeUndefined();
  });
});
