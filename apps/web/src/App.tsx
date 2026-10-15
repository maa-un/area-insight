export type Page = "home" | "not-found";

export function App({ page }: { page: Page }) {
  return (
    <div className="layout">
      <header className="header">
        <a className="logo" href="/">
          area-insight
        </a>
      </header>
      <main className="main">{page === "home" ? <Home /> : <NotFound />}</main>
      <footer className="footer">
        出典: 国土交通省 不動産情報ライブラリ、e-Stat（表示する文言は利用規約を確認して確定する）
      </footer>
    </div>
  );
}

function Home() {
  return (
    <>
      <section className="hero">
        <h1>どの市区町村で探すか、公的データで比べる</h1>
        <p>取引価格・地価・空き家率・人口を、全国の市区町村で見比べられます。</p>
      </section>
      <section className="entries">
        <Entry title="地図で探す" body="地価や駅ごとの相場を周辺と見比べる" />
        <Entry title="ランキングで探す" body="取引単価や空き家率で絞り込んで並べる" />
        <Entry title="比較する" body="候補を 3 つまで横に並べる" />
      </section>
      <p className="notice">現在準備中です。データの取り込みが終わりしだい公開します。</p>
    </>
  );
}

function Entry({ title, body }: { title: string; body: string }) {
  return (
    <div className="entry">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function NotFound() {
  return (
    <section className="hero">
      <h1>ページが見つかりません</h1>
      <p>
        <a href="/">トップへ戻る</a>
      </p>
    </section>
  );
}
