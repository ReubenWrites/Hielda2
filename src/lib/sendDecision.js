/**
 * The one question that matters most on the creation form: does Hielda
 * email the client, or not?
 *
 * The form has three controls that bear on it — the "Email the invoice to
 * your client" switch, the "Hielda sends it / I'll send it myself" choice
 * inside it, and the "I'll send the PDF myself" checkbox on the review
 * step. They grew up separately, and the send was gated on the first two
 * only. A user who ticked the third — whose own caption promised Hielda
 * wouldn't email the invoice — had an introduction emailed to their client
 * anyway, and the confirmation screen then reported it as a success.
 *
 * Rule: any "I'll do it myself" wins. Hielda never contacts a client the
 * user has said they'll contact themselves. Every surface that sends,
 * displays, or describes the send must go through this function so the
 * three controls cannot disagree again.
 */
export function shouldEmailClientOnCreate({ sendIntro, introMethod, meth }) {
  if (meth === "download") return false
  if (!sendIntro) return false
  return introMethod === "hielda"
}
