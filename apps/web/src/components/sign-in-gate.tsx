import { Lock, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { type AuthState, openSignIn, useAuth } from "@/lib/auth";

// ログインした人にだけページの中身を見せる。画面で隠すだけで、HTML に埋め込んだデータは守らない。
export function SignInGate({ children }: { children: ReactNode }) {
  return <SignInGateView status={useAuth().status}>{children}</SignInGateView>;
}

export function SignInGateView({
  status,
  children,
}: {
  status: AuthState["status"];
  children: ReactNode;
}) {
  // 公開キーが無い環境（開発・テスト）ではログイン機能が無いので、そのまま見せる。
  if (status === "disabled" || status === "signed-in") return children;
  // ログイン済みか確かめている間は、中身もログインの案内も出さない（一瞬見えるのを防ぐ）。
  if (status === "loading") return <div aria-busy className="min-h-[50vh]" />;
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <Eyebrow>会員限定</Eyebrow>
      <h1 className="text-2xl font-bold tracking-tight">ログインしてご利用ください</h1>
      <p className="text-sm leading-7 text-muted-foreground">
        マチノメの市区町村データ・地図・ランキングは、ログインした方だけが見られます。Google
        アカウントかメールアドレスでログインできます。
      </p>
      <Button size="lg" onClick={() => void openSignIn()}>
        <LogIn />
        ログインして使う
      </Button>
      <a
        href="/guide/"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        マチノメでできること
      </a>
    </section>
  );
}
