import { MAX_COMPARE } from "@area-insight/shared";
import { Check, Columns3, Heart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toggleCompare, toggleFavorite, useUserData } from "@/lib/user-data";

// 市区町村をお気に入り・比較リストに入れるボタン。
// お気に入りはログインが必要。ログイン機能が無い環境（公開キー未設定）では出さない。
export function AreaActions({ code, compact = false }: { code: string; compact?: boolean }) {
  const auth = useAuth();
  const { compare, favorites } = useUserData();
  const [full, setFull] = useState(false);
  const inCompare = compare.includes(code);
  const favorite = favorites.includes(code);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          size={compact ? "sm" : "default"}
          variant={inCompare ? "secondary" : "outline"}
          aria-pressed={inCompare}
          onClick={() => setFull(!toggleCompare(code))}
        >
          {inCompare ? <Check /> : <Columns3 />}
          {inCompare ? "比較リストに追加済み" : "比較に追加"}
        </Button>
        {auth.status !== "disabled" && (
          <Button
            size={compact ? "sm" : "default"}
            variant="outline"
            aria-pressed={favorite}
            disabled={auth.status === "loading"}
            onClick={() => toggleFavorite(code)}
          >
            <Heart className={favorite ? "fill-current text-rose-500" : undefined} />
            {favorite ? "お気に入り" : "お気に入りに追加"}
          </Button>
        )}
      </div>
      {full && (
        <p role="status" className="text-xs text-destructive">
          比較できるのは {MAX_COMPARE} つまでです。比較画面で外してから追加してください。
        </p>
      )}
    </div>
  );
}
