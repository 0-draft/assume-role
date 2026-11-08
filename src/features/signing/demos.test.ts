import { BEDROCK_BEARER, CREATE_ACCESS_KEY, SIGNING_DEMOS, wireText } from "./demos";
import { signRequest } from "./sigv4";

describe("signing demos", () => {
  it("annotate only text that is actually on the wire", () => {
    const messages = [
      ...SIGNING_DEMOS.map((d) => d.wire),
      CREATE_ACCESS_KEY.request,
      CREATE_ACCESS_KEY.response,
      BEDROCK_BEARER,
    ];
    for (const m of messages) {
      const text = wireText(m);
      for (const a of m.annotations ?? []) expect(text).toContain(a.match);
    }
  });

  it("wire headers match what the signer signs", () => {
    for (const d of SIGNING_DEMOS) {
      const wire = Object.fromEntries(
        d.wire.headers.map(([k, v]) => [k.toLowerCase(), v]),
      );
      for (const [k, v] of Object.entries(d.request.headers)) expect(wire[k]).toBe(v);
      expect(d.wire.body).toBe(d.request.body);
    }
  });

  it("signs the session token only for temporary credentials", async () => {
    const byId = Object.fromEntries(SIGNING_DEMOS.map((d) => [d.id, d]));
    const sign = (id: string) =>
      signRequest(byId[id].request, byId[id].credentials, byId[id].options);
    expect((await sign("long-term")).signedHeaders).not.toContain("x-amz-security-token");
    expect((await sign("temporary")).signedHeaders).toContain("x-amz-security-token");
    const sts = await sign("assume-role");
    expect(sts.credentialScope).toBe("20260919/us-east-1/sts/aws4_request");
    expect(sts.authorizationHeader).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA/);
  });
});
