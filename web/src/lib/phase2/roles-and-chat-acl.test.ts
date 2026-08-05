import assert from "node:assert/strict";
import {
  canMessageRole,
  canPostInChannel,
  canReactInChannel,
  canLeadRole,
  fieldRolesEquivalentInPhase2,
} from "./roles-and-chat-acl";

assert.equal(fieldRolesEquivalentInPhase2("petitioner", "canvasser"), true);
assert.equal(canLeadRole("petitioner"), true);
assert.equal(canLeadRole("canvasser"), true);
assert.equal(canLeadRole("validator"), false);

assert.equal(canMessageRole("super_admin", "petitioner").allowed, true);
assert.equal(canMessageRole("team_lead", "canvasser").allowed, true);
assert.equal(canMessageRole("petitioner", "super_admin").allowed, true);
assert.equal(canPostInChannel("petitioner", "announcement").allowed, false);
assert.equal(canPostInChannel("account_admin", "announcement").allowed, true);
assert.equal(canReactInChannel("petitioner", "announcement").allowed, true);

console.log("phase2 roles-and-chat-acl tests passed");
