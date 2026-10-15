import { createRemoteJWKSet, jwtVerify } from "jose";

// セッショントークンを検証し、ユーザー ID（Clerk の sub）を返す。失敗時は例外を投げる。
export type VerifyToken = (token: string) => Promise<string>;

// Clerk のセッショントークン（JWT）を公開鍵（JWKS）で検証する。公開鍵は jose がキャッシュする。
export function clerkTokenVerifier(issuer: string, authorizedParties: string[]): VerifyToken {
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    if (typeof payload.azp !== "string" || !authorizedParties.includes(payload.azp)) {
      throw new Error("token was issued for another origin");
    }
    if (!payload.sub) throw new Error("token has no subject");
    return payload.sub;
  };
}
