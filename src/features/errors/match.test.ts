import { ERRORS } from "./data";
import { matchError } from "./match";

const top = (s: string) => matchError(s)[0]?.id;

describe("matchError", () => {
  it("returns nothing for empty or unrelated input", () => {
    expect(matchError("")).toEqual([]);
    expect(matchError("   ")).toEqual([]);
    expect(matchError("hello world")).toEqual([]);
  });

  it("recognises real-world messages", () => {
    expect(
      top(
        "An error occurred (AccessDenied) when calling the AssumeRole operation: User: arn:aws:iam::111122223333:user/alice is not authorized to perform: sts:AssumeRole on resource: arn:aws:iam::444455556666:role/deploy",
      ),
    ).toBe("access-denied");
    expect(
      top(
        "An error occurred (ExpiredToken) when calling the GetCallerIdentity operation: The security token included in the request is expired",
      ),
    ).toBe("expired-token");
    expect(
      top(
        "An error occurred (InvalidClientTokenId) when calling the GetCallerIdentity operation: The security token included in the request is invalid.",
      ),
    ).toBe("invalid-client-token-id");
    expect(
      top(
        "An error occurred (InvalidIdentityToken) when calling the AssumeRoleWithWebIdentity operation: Incorrect token audience",
      ),
    ).toBe("invalid-identity-token");
    expect(
      top(
        "No OpenIDConnect provider found in your account for https://token.actions.githubusercontent.com",
      ),
    ).toBe("invalid-identity-token");
    expect(
      top("botocore.exceptions.ClientError: ThrottlingException: Rate exceeded"),
    ).toBe("throttling");
    expect(top("RegionDisabledException")).toBe("region-disabled");
    expect(top("PackedPolicyTooLarge")).toBe("packed-policy");
    expect(
      top("AuthFailure: AWS was not able to validate the provided access credentials"),
    ).toBe("opt-in-v1-token");
    expect(
      top(
        "The request signature we calculated does not match the signature you provided",
      ),
    ).toBe("signature");
  });

  it("prefers the specific error over a generic AccessDenied wrapper", () => {
    expect(top("AccessDenied ... OutboundWebIdentityFederationDisabled")).toBe(
      "outbound-disabled",
    );
  });

  it("is case-insensitive", () => {
    expect(top("packedpolicytoolarge")).toBe("packed-policy");
  });
});

describe("error catalog", () => {
  it("has unique ids, bilingual copy, a source and at least one pattern", () => {
    const ids = new Set(ERRORS.map((e) => e.id));
    expect(ids.size).toBe(ERRORS.length);
    for (const e of ERRORS) {
      for (const l of [e.symptom, e.cause, e.fix]) {
        expect(l.en.length, e.id).toBeGreaterThan(0);
        expect(l.ja.length, e.id).toBeGreaterThan(0);
      }
      expect(e.patterns.length, e.id).toBeGreaterThan(0);
      expect(e.source, e.id).toMatch(/^https:\/\//);
      expect(e.apis.length, e.id).toBeGreaterThan(0);
    }
  });

  it("every entry is found by its own symptom text", () => {
    for (const e of ERRORS) {
      expect(
        matchError(e.symptom.en).map((m) => m.id),
        e.id,
      ).toContain(e.id);
    }
  });
});
