// ページ移動の切り替えの動き（styles.css の @view-transition）は、次のページの用意に時間がかかったときなどに
// ブラウザが飛ばすことがある。飛ばすとブラウザは切り替えの Promise を reject し、拾う人がいないと
// コンソールに「Uncaught (in promise) AbortError: Transition was skipped」が出る。表示には影響しないので拾って捨てる。
// pagereveal は最初の描画の前に起きるため、モジュール（遅れて動く）ではなく head の通常のスクリプトで登録する。
(() => {
  const ignoreSkipped = (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    for (const promise of [transition.updateCallbackDone, transition.ready, transition.finished]) {
      promise?.catch(() => {});
    }
  };
  addEventListener("pageswap", ignoreSkipped);
  addEventListener("pagereveal", ignoreSkipped);
})();
