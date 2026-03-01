import { describe, it, expect } from "vitest";
import { isLikelyBot, estimateSeniority, computeSkillMatch } from "../search-helpers";
import type { Developer } from "@/types/developer";

function makeDev(overrides: Partial<Developer> & { username: string }): Developer {
  return {
    id: overrides.username,
    name: overrides.name ?? overrides.username,
    avatarUrl: "",
    bio: "",
    location: "",
    totalContributions: 0,
    publicRepos: 0,
    followers: 0,
    stars: 0,
    topLanguages: [],
    highlights: [],
    score: 50,
    hiddenGem: false,
    joinedYear: 2018,
    ...overrides,
  };
}

describe("isLikelyBot", () => {
  it("flags dependabot", () => {
    expect(isLikelyBot({ username: "dependabot" })).toBe(true);
  });

  it("flags renovate-bot", () => {
    expect(isLikelyBot({ username: "renovate-bot" })).toBe(true);
  });

  it("flags github-actions", () => {
    expect(isLikelyBot({ username: "github-actions" })).toBe(true);
  });

  it("flags codecov in username", () => {
    expect(isLikelyBot({ username: "my-codecov-helper" })).toBe(true);
  });

  it("flags usernames ending with [bot]", () => {
    expect(isLikelyBot({ username: "myapp[bot]" })).toBe(true);
  });

  it("flags usernames ending with -bot", () => {
    expect(isLikelyBot({ username: "deploy-bot" })).toBe(true);
  });

  it("does not flag normal usernames", () => {
    expect(isLikelyBot({ username: "alice" })).toBe(false);
    expect(isLikelyBot({ username: "john-dev" })).toBe(false);
    expect(isLikelyBot({ username: "robotics-fan" })).toBe(false);
  });

  it("handles empty/missing username", () => {
    expect(isLikelyBot({ username: "" })).toBe(false);
  });
});

describe("estimateSeniority", () => {
  const currentYear = new Date().getFullYear();

  it("returns senior for 8+ years active", () => {
    expect(estimateSeniority({ joinedYear: currentYear - 10, score: 30 })).toBe("senior");
  });

  it("returns senior for high score", () => {
    expect(estimateSeniority({ joinedYear: currentYear - 2, score: 75 })).toBe("senior");
  });

  it("returns mid for 4-7 years active", () => {
    expect(estimateSeniority({ joinedYear: currentYear - 5, score: 30 })).toBe("mid");
  });

  it("returns mid for moderate score", () => {
    expect(estimateSeniority({ joinedYear: currentYear - 1, score: 45 })).toBe("mid");
  });

  it("returns junior for < 4 years and low score", () => {
    expect(estimateSeniority({ joinedYear: currentYear - 2, score: 20 })).toBe("junior");
  });
});

describe("computeSkillMatch", () => {
  it("returns -1 when no skills provided", () => {
    expect(computeSkillMatch(makeDev({ username: "alice" }), [])).toBe(-1);
  });

  it("returns -1 when skills are all empty strings", () => {
    expect(
      computeSkillMatch(makeDev({ username: "alice" }), [
        { id: "1", text: "" },
        { id: "2", text: "  " },
      ]),
    ).toBe(-1);
  });

  it("returns > 0 when bio matches a skill keyword", () => {
    const dev = makeDev({ username: "alice", bio: "Full stack React developer" });
    const score = computeSkillMatch(dev, [{ id: "1", text: "React" }]);
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 when no skills match", () => {
    const dev = makeDev({ username: "alice", bio: "Python data scientist" });
    const score = computeSkillMatch(dev, [{ id: "1", text: "Haskell" }]);
    expect(score).toBe(0);
  });

  it("returns higher score when more skills match", () => {
    const dev = makeDev({
      username: "alice",
      bio: "React TypeScript developer",
      topLanguages: [{ name: "TypeScript", percentage: 60, color: "#3178c6" }],
    });
    const oneSkill = computeSkillMatch(dev, [{ id: "1", text: "React" }]);
    const twoSkills = computeSkillMatch(dev, [
      { id: "1", text: "React" },
      { id: "2", text: "TypeScript" },
    ]);
    expect(twoSkills).toBeGreaterThanOrEqual(oneSkill);
  });
});
