// 業務の決まりに反する操作。外側の層で「利用者の入力の誤り」として扱う（HTTP なら 400）。
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
