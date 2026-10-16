import { createRemoteJWKSet, jwtVerify } from "jose";
import type { TokenVerifier } from "../../application/ports.js";
import { type UserId, userIdOf } from "../../domain/values.js";

// Clerk のセッショントークン（JWT）を公開鍵（JWKS）で検証する。公開鍵は jose がキャッシュする。
export class ClerkTokenVerifier implements TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly issuer: string,
    private readonly authorizedParties: readonly string[],
  ) {
    this.jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<UserId> {
    const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer });
    if (typeof payload.azp !== "string" || !this.authorizedParties.includes(payload.azp)) {
      throw new Error("token was issued for another origin");
    }
    if (!payload.sub) throw new Error("token has no subject");
    return userIdOf(payload.sub);
  }
}
