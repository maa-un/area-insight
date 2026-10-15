import { LogIn } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { mountUserButton, openSignIn, useAuth } from "@/lib/auth";

// ヘッダー右上のログイン表示。公開キーが無い環境では何も出さない。
export function AuthMenu() {
  const auth = useAuth();

  if (auth.status === "disabled") return null;
  if (auth.status === "signed-in") return <UserButton />;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={auth.status === "loading"}
      onClick={() => void openSignIn()}
    >
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
