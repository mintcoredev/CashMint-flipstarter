"use strict";

const {
  validatePledgeAmount,
  buildPaymentUri,
  openPledgeModal,
  closePledgeModal,
  MIN_PLEDGE_BCH,
} = require("../pledge.js");

// ---------------------------------------------------------------------------
// validatePledgeAmount
// ---------------------------------------------------------------------------

describe("validatePledgeAmount", () => {
  const GOAL = 25;

  test("returns valid for a normal amount within goal", () => {
    expect(validatePledgeAmount("5", GOAL)).toEqual({ valid: true });
    expect(validatePledgeAmount(0.5, GOAL)).toEqual({ valid: true });
    expect(validatePledgeAmount(GOAL, GOAL)).toEqual({ valid: true });
  });

  test("rejects empty string", () => {
    const result = validatePledgeAmount("", GOAL);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/enter a pledge amount/i);
  });

  test("rejects null / undefined / NaN", () => {
    expect(validatePledgeAmount(null, GOAL).valid).toBe(false);
    expect(validatePledgeAmount(undefined, GOAL).valid).toBe(false);
    expect(validatePledgeAmount("abc", GOAL).valid).toBe(false);
  });

  test("rejects zero or negative amounts", () => {
    expect(validatePledgeAmount("0", GOAL).valid).toBe(false);
    expect(validatePledgeAmount("-1", GOAL).valid).toBe(false);
  });

  test("rejects amount below minimum pledge", () => {
    const tooSmall = MIN_PLEDGE_BCH / 2;
    const result = validatePledgeAmount(tooSmall, GOAL);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/minimum/i);
  });

  test("rejects amount greater than campaign goal", () => {
    const result = validatePledgeAmount(GOAL + 1, GOAL);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });
});

// ---------------------------------------------------------------------------
// buildPaymentUri
// ---------------------------------------------------------------------------

describe("buildPaymentUri", () => {
  const ADDRESS_BARE = "qpzk2nhp2uyld8fzp09gjz6mzezjyy7emv3y5qclj";
  const ADDRESS_PREFIXED = `bitcoincash:${ADDRESS_BARE}`;

  test("builds a valid bitcoincash: URI from bare address", () => {
    const uri = buildPaymentUri(ADDRESS_BARE, 0.5);
    expect(uri).toBe(`bitcoincash:${ADDRESS_BARE}?amount=0.5`);
  });

  test("builds a valid bitcoincash: URI from prefixed address", () => {
    const uri = buildPaymentUri(ADDRESS_PREFIXED, 2);
    expect(uri).toBe(`bitcoincash:${ADDRESS_BARE}?amount=2`);
  });

  test("handles case-insensitive prefix stripping", () => {
    const uri = buildPaymentUri(`BitcoinCash:${ADDRESS_BARE}`, 1);
    expect(uri).toBe(`bitcoincash:${ADDRESS_BARE}?amount=1`);
  });

  test("preserves decimal precision in amount", () => {
    const uri = buildPaymentUri(ADDRESS_BARE, 0.001);
    expect(uri).toContain("amount=0.001");
  });
});

// ---------------------------------------------------------------------------
// openPledgeModal / closePledgeModal (DOM interactions via jsdom)
// ---------------------------------------------------------------------------

describe("openPledgeModal", () => {
  let doc;

  beforeEach(() => {
    // Provide a minimal jsdom document for each test
    doc = document.implementation.createHTMLDocument("test");
  });

  afterEach(() => {
    // Clean up the modal if it was injected
    const modal = doc.getElementById("pledge-modal");
    if (modal) modal.remove();
  });

  test("injects a modal into the document", () => {
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, doc });
    expect(doc.getElementById("pledge-modal")).not.toBeNull();
  });

  test("modal contains amount input, confirm, and cancel buttons", () => {
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, doc });
    expect(doc.getElementById("pledge-amount")).not.toBeNull();
    expect(doc.getElementById("pledge-confirm")).not.toBeNull();
    expect(doc.getElementById("pledge-cancel")).not.toBeNull();
  });

  test("calling openPledgeModal twice does not duplicate the modal", () => {
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, doc });
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, doc });
    expect(doc.querySelectorAll("#pledge-modal").length).toBe(1);
  });

  test("cancel button hides the modal and calls onCancel", () => {
    const onCancel = jest.fn();
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, onCancel, doc });
    doc.getElementById("pledge-cancel").click();
    expect(doc.getElementById("pledge-modal").style.display).toBe("none");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("confirm with empty amount shows validation error", () => {
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, doc });
    doc.getElementById("pledge-confirm").click();
    const error = doc.getElementById("pledge-error").textContent;
    expect(error).toMatch(/enter a pledge amount/i);
  });

  test("confirm with invalid amount shows validation error", () => {
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, doc });
    doc.getElementById("pledge-amount").value = "-5";
    doc.getElementById("pledge-confirm").click();
    const error = doc.getElementById("pledge-error").textContent;
    expect(error).toBeTruthy();
  });

  test("confirm with valid amount calls onSuccess with payment URI", () => {
    const onSuccess = jest.fn();
    const address = "bitcoincash:qpzk2nhp2uyld8fzp09gjz6mzezjyy7emv3y5qclj";
    openPledgeModal({ recipientAddress: address, goalBch: 25, onSuccess, doc });
    doc.getElementById("pledge-amount").value = "1";
    doc.getElementById("pledge-confirm").click();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    const uri = onSuccess.mock.calls[0][0];
    expect(uri).toContain("bitcoincash:");
    expect(uri).toContain("amount=1");
  });

  test("modal is closed after successful pledge confirmation", () => {
    const onSuccess = jest.fn();
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, onSuccess, doc });
    doc.getElementById("pledge-amount").value = "2";
    doc.getElementById("pledge-confirm").click();
    expect(doc.getElementById("pledge-modal").style.display).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// closePledgeModal
// ---------------------------------------------------------------------------

describe("closePledgeModal", () => {
  let doc;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument("test");
  });

  test("hides an open modal", () => {
    openPledgeModal({ recipientAddress: "bitcoincash:qtest", goalBch: 25, doc });
    closePledgeModal(doc);
    expect(doc.getElementById("pledge-modal").style.display).toBe("none");
  });

  test("does nothing when modal does not exist", () => {
    expect(() => closePledgeModal(doc)).not.toThrow();
  });
});
