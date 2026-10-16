import { LogIn, LogOut } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { mountUserButton, openSignIn, signOut, useAuth } from "@/lib/auth";

// ヘッダー右上のログイン表示。公開キーが無い環境では何も出さない。
export function AuthMenu() {
  const auth = useAuth();

  if (auth.status === "disabled") return null;
  // 読み込み中はログイン済みかどうか分からないので、ボタンを出さずに場所だけ確保する。
  // ログイン済みの人にログインボタンが一瞬見えるのを防ぐ。
  if (auth.status === "loading") return <div aria-hidden className="h-8 w-28" />;
  if (auth.status === "signed-in") {
    return (
      <div className="flex items-center gap-2">
        <UserButton />
        {/* 幅の狭い画面ではアイコンだけにする */}
        <Button size="sm" variant="ghost" aria-label="ログアウト" onClick={() => void signOut()}>
          <LogOut />
          <span className="hidden sm:inline">ログアウト</span>
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={() => void openSignIn()}>
      <LogIn />
      Google でログイン
    </Button>
  );
}

function UserButton() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;
    void mountUserButton(node).then((fn) => {
      if (cancelled) fn();
      else unmount = fn;
    });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  // Clerk のユーザーボタンの大きさに合わせて場所を確保し、表示のずれを防ぐ。
  return <div ref={ref} className="size-7" />;
}
