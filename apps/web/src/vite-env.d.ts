/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Clerk の公開キー（pk_...）。ブラウザに渡してよい値。未設定ならログイン機能を出さない。
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}
