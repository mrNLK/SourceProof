import { describe, it, expect } from "vitest";
import {
  computeEEA,
  developerToCandidate,
  STRENGTH_LABELS,
  type CandidateData,
  type EEAProfile,
} from "../eea";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal candidate with no meaningful data. */
const empty: CandidateData = {};

/** Find a dimension by id from an EEAProfile. */
function dim(profile: EEAProfile, id: string) {
  return profile.dimensions.find((d) => d.id === id)!;
}

// ---------------------------------------------------------------------------
// 1. computeEEA — empty / minimal data
// ---------------------------------------------------------------------------

describe("computeEEA with empty/minimal data", () => {
  it("returns all dimensions with strength 0 when given empty input", () => {
    const profile = computeEEA(empty);
    for (const d of profile.dimensions) {
      expect(d.strength).toBe(0);
    }
  });

  it("returns the 'Limited Data' tier for empty input", () => {
    const profile = computeEEA(empty);
    expect(profile.tier.label).toBe("Limited Data");
  });

  it("returns overallScore of 0 for empty input", () => {
    const profile = computeEEA(empty);
    expect(profile.overallScore).toBe(0);
  });

  it("returns strongCount of 0 for empty input", () => {
    const profile = computeEEA(empty);
    expect(profile.strongCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. computeEEA — always returns 11 dimensions (6 USCIS + 5 supplementary)
// ---------------------------------------------------------------------------

describe("computeEEA dimension count", () => {
  it("returns exactly 11 dimensions in the correct order", () => {
    const profile = computeEEA(empty);
    expect(profile.dimensions).toHaveLength(11);
    const ids = profile.dimensions.map((d) => d.id);
    expect(ids).toEqual([
      "original_contributions",
      "critical_role",
      "published_material",
      "judging",
      "remuneration",
      "membership",
      "sustained_excellence",
      "technical_profile",
      "velocity",
      "builder_dna",
      "early_mover",
    ]);
  });

  it("has 6 uscis and 5 supplementary dimensions", () => {
    const profile = computeEEA(empty);
    const uscis = profile.dimensions.filter((d) => d.criterion === "uscis");
    const supplementary = profile.dimensions.filter(
      (d) => d.criterion === "supplementary"
    );
    expect(uscis).toHaveLength(6);
    expect(supplementary).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// 3. Original Contributions — star thresholds
// ---------------------------------------------------------------------------

describe("Original Contributions scoring", () => {
  it("scores strength 4 for stars >= 5000", () => {
    const profile = computeEEA({ stars: 6000 });
    expect(dim(profile, "original_contributions").strength).toBe(4);
  });

  it("scores strength 3 for stars 1000-4999", () => {
    const profile = computeEEA({ stars: 2500 });
    expect(dim(profile, "original_contributions").strength).toBe(3);
  });

  it("scores strength 2 for stars 200-999", () => {
    const profile = computeEEA({ stars: 500 });
    expect(dim(profile, "original_contributions").strength).toBe(2);
  });

  it("scores strength 1 for stars 50-199", () => {
    const profile = computeEEA({ stars: 100 });
    expect(dim(profile, "original_contributions").strength).toBe(1);
  });

  it("scores strength 0 for stars < 50", () => {
    const profile = computeEEA({ stars: 10 });
    expect(dim(profile, "original_contributions").strength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Critical Role — founder + CTO + contributed repos with high commits
// ---------------------------------------------------------------------------

describe("Critical / Leading Role scoring", () => {
  it("scores strength 4 when bio has founder + CTO and high commit contributions", () => {
    const profile = computeEEA({
      bio: "Founder and CTO of a deep-tech startup",
      contributed_repos: { "myorg/core": 60 },
    });
    const d = dim(profile, "critical_role");
    // 2 leadership signals (founder, cto) + maxCommits 60 >= 50 => strength 4
    expect(d.strength).toBe(4);
    expect(d.evidence.some((e) => e.includes("Founder"))).toBe(true);
    expect(d.evidence.some((e) => e.includes("CTO"))).toBe(true);
  });

  it("scores strength 0 with no leadership signals and no contributions", () => {
    const profile = computeEEA({ bio: "I like coding" });
    expect(dim(profile, "critical_role").strength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Published Material — arxiv, phd, speaker, high followers
// ---------------------------------------------------------------------------

describe("Published Material scoring", () => {
  it("scores strength 4 with multiple publication signals and 1000+ followers", () => {
    const profile = computeEEA({
      bio: "PhD researcher, published on arxiv, conference speaker, author",
      followers: 1200,
    });
    const d = dim(profile, "published_material");
    // signals: arxiv -> Research publications, phd -> PhD, speaker -> Conference speaker,
    //          author -> Technical writing / Author, 1200 followers -> widely recognized
    // 5 signals >= 4 => strength 4
    expect(d.strength).toBe(4);
  });

  it("scores strength >= 3 with PhD, NeurIPS, and 1000+ followers", () => {
    const profile = computeEEA({
      followers: 1200,
      bio: "PhD in machine learning. Published at NeurIPS.",
    });
    const d = dim(profile, "published_material");
    expect(d.strength).toBeGreaterThanOrEqual(3);
    expect(d.evidence.some((e) => e.includes("follower"))).toBe(true);
  });

  it("scores strength 1 with a single weak signal", () => {
    const profile = computeEEA({
      bio: "I gave a talk at a conference once",
      followers: 10,
    });
    expect(dim(profile, "published_material").strength).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Judging — reviewer, maintainer signals
// ---------------------------------------------------------------------------

describe("Judging & Peer Review scoring", () => {
  it("scores strength 3 when bio contains reviewer and maintainer (2 signals)", () => {
    const profile = computeEEA({
      bio: "Open-source maintainer. Peer reviewer for ICML.",
    });
    const d = dim(profile, "judging");
    // "reviewer" -> Peer reviewer, "maintainer" -> Open-source maintainer = 2 signals => strength 3
    expect(d.strength).toBe(3);
    expect(d.evidence.some((e) => e.includes("reviewer"))).toBe(true);
    expect(d.evidence.some((e) => e.includes("maintainer"))).toBe(true);
  });

  it("scores strength 1 as indirect signal from stars >= 100 or 2+ contributed repos", () => {
    const profile = computeEEA({
      contributed_repos: { "a/b": 5, "c/d": 3 },
      stars: 100,
    });
    // repoCount=2 >= 2 or stars=100 >= 100 => strength 1
    expect(dim(profile, "judging").strength).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Remuneration — CTO + Google proxy signals
// ---------------------------------------------------------------------------

describe("Remuneration scoring", () => {
  it("scores strength 2 with two proxy signals (founder + FAANG)", () => {
    const profile = computeEEA({
      bio: "Founder. Previously at Google.",
    });
    expect(dim(profile, "remuneration").strength).toBeGreaterThanOrEqual(2);
  });

  it("scores strength 3 with three proxy signals (CTO + co-founder + FAANG)", () => {
    const profile = computeEEA({
      bio: "CTO and co-founder at Google",
    });
    // "cto" => C-level, "co-founder" => Founder, "google" => FAANG => 3 proxies => strength 3
    expect(dim(profile, "remuneration").strength).toBe(3);
  });

  it("scores strength 0 when bio has no salary proxy signals", () => {
    const profile = computeEEA({ bio: "I like coding" });
    expect(dim(profile, "remuneration").strength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Membership — Y Combinator, contributed to major org repos
// ---------------------------------------------------------------------------

describe("Membership scoring", () => {
  it("scores strength 2 when bio mentions Y Combinator", () => {
    const profile = computeEEA({
      bio: "Y Combinator W23 alumni",
    });
    // 1 signal (Accelerator alumni) => strength 2
    expect(dim(profile, "membership").strength).toBe(2);
  });

  it("scores strength >= 2 when contributing to major org repos", () => {
    const profile = computeEEA({
      contributed_repos: {
        "kubernetes/kubernetes": 20,
        "mozilla/servo": 10,
      },
    });
    // majorOrgs filter finds kubernetes and mozilla => 1 signal
    expect(dim(profile, "membership").strength).toBeGreaterThanOrEqual(2);
  });

  it("scores strength 1 when contributing to 3+ non-major org repos", () => {
    const profile = computeEEA({
      contributed_repos: {
        "small/a": 5,
        "small/b": 5,
        "small/c": 5,
      },
    });
    // No bio signals, no major orgs, but 3 repos => strength 1
    expect(dim(profile, "membership").strength).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Sustained Excellence — old account + many repos
// ---------------------------------------------------------------------------

describe("Sustained Technical Excellence scoring", () => {
  it("scores strength 4 for 12+ years active with 30+ repos", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      joined_year: currentYear - 13,
      public_repos: 35,
    });
    expect(dim(profile, "sustained_excellence").strength).toBe(4);
  });

  it("scores strength 3 for 8+ years active with 20+ repos", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      joined_year: currentYear - 8,
      public_repos: 20,
    });
    expect(dim(profile, "sustained_excellence").strength).toBe(3);
  });

  it("scores strength 0 when joined_year is not provided", () => {
    const profile = computeEEA({ public_repos: 50 });
    expect(dim(profile, "sustained_excellence").strength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Technical Profile — multiple languages with depth + many repos
// ---------------------------------------------------------------------------

describe("Technical Profile scoring", () => {
  it("scores strength 4 with 3+ languages, depth in primary, and 20+ repos", () => {
    const profile = computeEEA({
      top_languages: [
        { name: "TypeScript", percentage: 55 },
        { name: "Python", percentage: 25 },
        { name: "Rust", percentage: 15 },
        { name: "Go", percentage: 5 },
      ],
      public_repos: 25,
    });
    // 4 langs (breadth) + 55% depth in TS + 25 repos => strength 4
    expect(dim(profile, "technical_profile").strength).toBe(4);
  });

  it("scores strength 1 with only one language and few repos", () => {
    const profile = computeEEA({
      top_languages: [{ name: "JavaScript", percentage: 100 }],
      public_repos: 3,
    });
    expect(dim(profile, "technical_profile").strength).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 11. Velocity — high repos/year and stars/year
// ---------------------------------------------------------------------------

describe("Velocity & Trajectory scoring", () => {
  it("scores strength 4 with exceptional repos/year and stars/year", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      joined_year: currentYear - 2, // 2 years active
      public_repos: 40, // 20 repos/year
      stars: 300, // 150 stars/year
    });
    // reposPerYear=20 >= 15 AND starsPerYear=150 >= 100 => strength 4
    expect(dim(profile, "velocity").strength).toBe(4);
  });

  it("scores strength 0 when joined_year is not provided", () => {
    const profile = computeEEA({ public_repos: 50, stars: 1000 });
    expect(dim(profile, "velocity").strength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Builder DNA — maker, hackathon + high repo count
// ---------------------------------------------------------------------------

describe("Builder DNA scoring", () => {
  it("scores high strength with hackathon + maker + prolific repos + highlights", () => {
    const profile = computeEEA({
      bio: "Hackathon winner. Indie maker. Build in public.",
      public_repos: 50,
      highlights: ["proj1", "proj2", "proj3"],
    });
    const d = dim(profile, "builder_dna");
    // hackathon, maker, build-in-public, 50 repos (prolific), 3 highlights = 5 signals => strength 4
    expect(d.strength).toBeGreaterThanOrEqual(3);
  });

  it("scores strength >= 1 with 50+ public repos alone", () => {
    const profile = computeEEA({ public_repos: 55 });
    const d = dim(profile, "builder_dna");
    expect(d.strength).toBeGreaterThanOrEqual(1);
    expect(d.evidence.some((e) => e.includes("prolific builder"))).toBe(true);
  });

  it("scores strength 0 with no builder signals", () => {
    const profile = computeEEA({});
    expect(dim(profile, "builder_dna").strength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 13. Early Mover — rust, wasm, emerging tech
// ---------------------------------------------------------------------------

describe("Early Mover scoring", () => {
  it("scores strength >= 1 when using Rust in top_languages", () => {
    const profile = computeEEA({
      top_languages: [{ name: "Rust", percentage: 60 }],
    });
    expect(dim(profile, "early_mover").strength).toBeGreaterThanOrEqual(1);
  });

  it("scores strength >= 1 when bio mentions wasm / WebAssembly", () => {
    const profile = computeEEA({
      bio: "Building tools for wasm and the web",
    });
    expect(dim(profile, "early_mover").strength).toBeGreaterThanOrEqual(1);
  });

  it("scores strength >= 2 with Rust + Zig + wasm combined", () => {
    const profile = computeEEA({
      top_languages: [
        { name: "Rust", percentage: 50 },
        { name: "Zig", percentage: 30 },
        { name: "TypeScript", percentage: 20 },
      ],
      bio: "Building with WebAssembly",
    });
    const d = dim(profile, "early_mover");
    // signals: Rust, Zig, wasm => 3 signals => strength 3
    expect(d.strength).toBeGreaterThanOrEqual(2);
    expect(d.evidence.some((e) => e.toLowerCase().includes("rust"))).toBe(true);
    expect(d.evidence.some((e) => e.toLowerCase().includes("zig"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 14. Tier calculation — score thresholds
// ---------------------------------------------------------------------------

describe("Tier classification", () => {
  it("returns 'Exceptional EEA Case' for score >= 70", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      stars: 8000,
      followers: 2000,
      public_repos: 60,
      joined_year: currentYear - 14,
      bio: "Founder CTO. PhD. Speaker. Maintainer. Reviewer. Staff engineer at Google. YC alum. Fellowship. Hackathon. Maker. Build in public. Open source.",
      top_languages: [
        { name: "Rust", percentage: 40 },
        { name: "TypeScript", percentage: 30 },
        { name: "Python", percentage: 20 },
        { name: "Zig", percentage: 10 },
      ],
      contributed_repos: {
        "google/project": 100,
        "meta/lib": 50,
        "org/tool": 30,
        "other/app": 20,
        "extra/thing": 10,
        "another/repo": 5,
      },
      highlights: ["a (500\u2b50)", "b (200\u2b50)", "c", "d", "e"],
      is_hidden_gem: false,
    });
    expect(profile.overallScore).toBeGreaterThanOrEqual(70);
    expect(profile.tier.label).toBe("Exceptional EEA Case");
  });

  it("returns 'Strong EEA Signals' for score in 50-69 range", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      stars: 3000,
      followers: 500,
      public_repos: 30,
      joined_year: currentYear - 10,
      bio: "Founder. Speaker. Reviewer.",
      top_languages: [
        { name: "TypeScript", percentage: 50 },
        { name: "Python", percentage: 30 },
        { name: "Go", percentage: 20 },
      ],
      contributed_repos: { "org/lib": 40, "other/tool": 20 },
      highlights: ["proj1 (150\u2b50)", "proj2"],
    });
    expect(profile.overallScore).toBeGreaterThanOrEqual(50);
    expect(profile.overallScore).toBeLessThan(70);
    expect(profile.tier.label).toBe("Strong EEA Signals");
  });

  it("returns 'Moderate EEA Signals' for score in 30-49 range", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      stars: 800,
      followers: 150,
      public_repos: 20,
      joined_year: currentYear - 8,
      bio: "Software engineer. Speaker. Reviewer.",
      top_languages: [
        { name: "JavaScript", percentage: 50 },
        { name: "Python", percentage: 30 },
        { name: "Go", percentage: 20 },
      ],
      contributed_repos: { "org/lib": 15 },
    });
    expect(profile.overallScore).toBeGreaterThanOrEqual(30);
    expect(profile.overallScore).toBeLessThan(50);
    expect(profile.tier.label).toBe("Moderate EEA Signals");
  });
});

// ---------------------------------------------------------------------------
// 15. developerToCandidate — camelCase mapping
// ---------------------------------------------------------------------------

describe("developerToCandidate camelCase mapping", () => {
  it("maps camelCase Developer fields correctly", () => {
    const dev = {
      stars: 500,
      followers: 100,
      publicRepos: 20,
      joinedYear: 2015,
      topLanguages: [{ name: "Rust", percentage: 80 }],
      highlights: ["cool project"],
      contributedRepos: { "org/repo": 30 },
      bio: "Hacker",
      about: "Loves Rust",
      hiddenGem: true,
    };
    const c = developerToCandidate(dev);
    expect(c.stars).toBe(500);
    expect(c.followers).toBe(100);
    expect(c.public_repos).toBe(20);
    expect(c.joined_year).toBe(2015);
    expect(c.top_languages).toEqual([{ name: "Rust", percentage: 80 }]);
    expect(c.highlights).toEqual(["cool project"]);
    expect(c.contributed_repos).toEqual({ "org/repo": 30 });
    expect(c.bio).toBe("Hacker");
    expect(c.about).toBe("Loves Rust");
    expect(c.is_hidden_gem).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 16. developerToCandidate — snake_case mapping
// ---------------------------------------------------------------------------

describe("developerToCandidate snake_case mapping", () => {
  it("maps snake_case candidate row fields correctly", () => {
    const row = {
      stars: 800,
      followers: 50,
      public_repos: 12,
      joined_year: 2018,
      top_languages: [{ name: "Go", percentage: 70 }],
      highlights: ["go tool"],
      contributed_repos: { "golang/go": 5 },
      bio: "Gopher",
      about: "",
      is_hidden_gem: false,
    };
    const c = developerToCandidate(row);
    expect(c.stars).toBe(800);
    expect(c.public_repos).toBe(12);
    expect(c.joined_year).toBe(2018);
    expect(c.top_languages).toEqual([{ name: "Go", percentage: 70 }]);
    expect(c.is_hidden_gem).toBe(false);
  });

  it("prefers 'totalStars' as fallback when 'stars' is undefined", () => {
    const dev = { totalStars: 999 };
    const c = developerToCandidate(dev);
    expect(c.stars).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// 17. developerToCandidate — missing/undefined fields
// ---------------------------------------------------------------------------

describe("developerToCandidate handles missing fields", () => {
  it("returns defaults for completely empty input", () => {
    const c = developerToCandidate({});
    expect(c.stars).toBe(0);
    expect(c.followers).toBe(0);
    expect(c.public_repos).toBe(0);
    expect(c.joined_year).toBeUndefined();
    expect(c.top_languages).toEqual([]);
    expect(c.highlights).toEqual([]);
    expect(c.contributed_repos).toEqual({});
    expect(c.bio).toBe("");
    expect(c.about).toBe("");
    expect(c.is_hidden_gem).toBe(false);
  });

  it("handles explicitly undefined values gracefully", () => {
    const dev = {
      stars: undefined,
      publicRepos: undefined,
      bio: undefined,
    };
    const c = developerToCandidate(dev);
    expect(c.stars).toBe(0);
    expect(c.public_repos).toBe(0);
    expect(c.bio).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 18. topSignals — contains strongest dimensions
// ---------------------------------------------------------------------------

describe("computeEEA topSignals", () => {
  it("contains labels from the strongest dimensions (strength >= 2)", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      stars: 5000,
      followers: 300,
      public_repos: 20,
      joined_year: currentYear - 10,
      bio: "Founder. Speaker. Reviewer. Maintainer.",
      top_languages: [
        { name: "TypeScript", percentage: 50 },
        { name: "Python", percentage: 30 },
        { name: "Go", percentage: 20 },
      ],
      contributed_repos: { "org/lib": 40 },
    });
    expect(profile.topSignals.length).toBeLessThanOrEqual(3);
    expect(profile.topSignals.length).toBeGreaterThan(0);
    for (const signal of profile.topSignals) {
      expect(typeof signal).toBe("string");
      expect(signal.length).toBeGreaterThan(0);
    }
  });

  it("returns empty topSignals when no dimension reaches strength 2", () => {
    const profile = computeEEA({});
    expect(profile.topSignals).toEqual([]);
  });

  it("includes 'Original Work' when stars push that dimension to exceptional", () => {
    const profile = computeEEA({ stars: 6000 });
    const hasOriginalWork = profile.topSignals.some((s) =>
      s.includes("Original Work")
    );
    expect(hasOriginalWork).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 19. documentationGaps — USCIS dimensions with strength < 3
// ---------------------------------------------------------------------------

describe("computeEEA documentationGaps", () => {
  it("includes gaps from USCIS dimensions with strength < 3", () => {
    const profile = computeEEA({}); // all strengths are 0
    expect(profile.documentationGaps.length).toBeGreaterThan(0);
    expect(profile.documentationGaps.length).toBeLessThanOrEqual(4);
    for (const gap of profile.documentationGaps) {
      expect(typeof gap).toBe("string");
      expect(gap.length).toBeGreaterThan(0);
    }
  });

  it("has fewer gaps when USCIS dimensions are strong", () => {
    const profileStrong = computeEEA({
      stars: 6000,
      bio: "Founder CTO at Google, PhD arxiv speaker author reviewer maintainer mentor, Y Combinator scholar",
      contributed_repos: { "google/proj": 100, "meta/proj": 50 },
      followers: 2000,
    });
    const profileWeak = computeEEA({});
    expect(profileStrong.documentationGaps.length).toBeLessThanOrEqual(
      profileWeak.documentationGaps.length
    );
  });
});

// ---------------------------------------------------------------------------
// 20. strongCount — dimensions with strength >= 3
// ---------------------------------------------------------------------------

describe("computeEEA strongCount", () => {
  it("counts 0 strong dimensions for empty input", () => {
    const profile = computeEEA({});
    expect(profile.strongCount).toBe(0);
  });

  it("counts dimensions with strength >= 3 and matches manual count", () => {
    const currentYear = new Date().getFullYear();
    const profile = computeEEA({
      stars: 6000, // original_contributions => 4
      bio: "Founder CTO. Reviewer. Maintainer.", // critical_role >= 3, judging >= 3
      contributed_repos: { "org/core": 80 },
      joined_year: currentYear - 14,
      public_repos: 35, // sustained_excellence => 4
    });
    expect(profile.strongCount).toBeGreaterThanOrEqual(3);
    // Verify strongCount matches actual dimension filtering
    const manualCount = profile.dimensions.filter(
      (d) => d.strength >= 3
    ).length;
    expect(profile.strongCount).toBe(manualCount);
  });
});
