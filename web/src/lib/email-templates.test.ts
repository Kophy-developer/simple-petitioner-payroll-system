import assert from "node:assert/strict";
import { inviteEmailContent, passwordResetEmailContent, checkoutReminderEmailContent } from "./email-templates";

const invite = inviteEmailContent("Jordan", "https://example.com/reset");
assert.match(invite.subject, /Ballot Access Pros/i);
assert.match(invite.html, /Set password/);
assert.doesNotMatch(invite.html, /Aug 1|demo1234/i);

const reset = passwordResetEmailContent("https://example.com/reset");
assert.match(reset.subject, /reset/i);
assert.match(reset.html, /Reset password/);

const checkout = checkoutReminderEmailContent({
  firstName: "Alex",
  propertyName: "Summit Inn",
  roomNumber: "12",
});
assert.match(checkout.text, /Summit Inn/);
assert.match(checkout.text, /12/);

console.log("email-templates tests passed");
