import { describe, expect, it } from "vitest";
import { MemoryPreferencesRepository } from "../adapters/memory/memory-preferences-repository.js";
import { DomainError } from "../domain/errors.js";
import { userIdOf } from "../domain/values.js";
import { PreferencesService } from "./preferences-service.js";

const user = userIdOf("user_1");
const other = userIdOf("user_2");

function setup() {
  const repository = new MemoryPreferencesRepository();
  return { repository, service: new PreferencesService(repository) };
}

describe("PreferencesService", () => {
  it("returns empty preferences for a new user", async () => {
    const { service } = setup();
    expect(await service.get(user)).toEqual({ favorites: [], compare: [], filters: [] });
  });

  it("saves changes for that user only", async () => {
    const { service } = setup();
    await service.replaceFavorites(user, ["13101"]);
    expect((await service.get(user)).favorites).toEqual(["13101"]);
    expect((await service.get(other)).favorites).toEqual([]);
  });

  it("keeps the other lists when one list changes", async () => {
    const { service } = setup();
    await service.replaceFavorites(user, ["13101"]);
    await service.replaceCompare(user, ["27100"]);
    expect(await service.get(user)).toMatchObject({ favorites: ["13101"], compare: ["27100"] });
  });

  it("does not save when a rule is broken", async () => {
    const { service, repository } = setup();
    await expect(
      service.replaceCompare(user, ["13101", "13102", "13103", "13104"]),
    ).rejects.toThrow(DomainError);
    expect(repository.snapshots.has(user)).toBe(false);
  });

  it("deletes the data of a deleted account", async () => {
    const { service, repository } = setup();
    await service.replaceFavorites(user, ["13101"]);
    await service.handleAccountEvent({ type: "account-deleted", userId: user });
    expect(repository.snapshots.has(user)).toBe(false);
  });

  it("ignores other account events", async () => {
    const { service, repository } = setup();
    await service.replaceFavorites(user, ["13101"]);
    await service.handleAccountEvent({ type: "ignored" });
    expect(repository.snapshots.has(user)).toBe(true);
  });
});
