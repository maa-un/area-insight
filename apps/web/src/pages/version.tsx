// デプロイしている版を確認するページ。検索には載せない（routes.ts の noindex）。
export function VersionPage() {
  return (
    <section className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-2xl font-bold tracking-tight">バージョン</h1>
      <p className="font-mono text-lg">{`v${__APP_VERSION__}`}</p>
    </section>
  );
}
