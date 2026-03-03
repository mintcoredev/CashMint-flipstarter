/**
 * Pledge flow for the CashMint Flipstarter page.
 *
 * Provides helpers to validate pledge amounts, build BCH payment URIs,
 * and open/close the pledge modal in the UI.
 */

const MIN_PLEDGE_BCH = 0.001;

/**
 * Validate a pledge amount string entered by the user.
 * Returns { valid: true } on success or { valid: false, error: string } on failure.
 *
 * @param {string|number} amount - The raw value from the pledge input.
 * @param {number} goalBch - The campaign goal in BCH.
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePledgeAmount(amount, goalBch) {
  const parsed = parseFloat(amount);
  if (amount === "" || amount === null || amount === undefined || isNaN(parsed)) {
    return { valid: false, error: "Please enter a pledge amount." };
  }
  if (parsed <= 0) {
    return { valid: false, error: "Pledge amount must be greater than zero." };
  }
  if (parsed < MIN_PLEDGE_BCH) {
    return {
      valid: false,
      error: `Minimum pledge is ${MIN_PLEDGE_BCH} BCH.`,
    };
  }
  if (parsed > goalBch) {
    return {
      valid: false,
      error: `Pledge amount cannot exceed the campaign goal of ${goalBch} BCH.`,
    };
  }
  return { valid: true };
}

/**
 * Build a bitcoincash: payment URI for the given address and amount.
 *
 * @param {string} address - The BCH address (may include "bitcoincash:" prefix).
 * @param {number} amountBch - The amount in BCH.
 * @returns {string} The payment URI.
 */
function buildPaymentUri(address, amountBch) {
  const bare = address.replace(/^bitcoincash:/i, "");
  return `bitcoincash:${bare}?amount=${amountBch}`;
}

/**
 * Open the pledge modal, wiring up submit and cancel handlers.
 *
 * @param {object} options
 * @param {string}   options.recipientAddress - BCH address to receive the pledge.
 * @param {number}   options.goalBch          - Campaign goal in BCH.
 * @param {Function} [options.onSuccess]      - Called with the payment URI when the
 *                                               user confirms a valid pledge.
 * @param {Function} [options.onCancel]       - Called when the user cancels.
 * @param {Document} [options.doc]            - DOM document (injectable for tests).
 */
function openPledgeModal({ recipientAddress, goalBch, onSuccess, onCancel, doc = document }) {
  let modal = doc.getElementById("pledge-modal");
  if (modal) {
    modal.style.display = "flex";
    return;
  }

  modal = doc.createElement("div");
  modal.id = "pledge-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "pledge-modal-title");
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;" +
    "align-items:center;justify-content:center;z-index:1000;";

  modal.innerHTML = `
    <div id="pledge-modal-inner"
         style="background:#fff;border-radius:8px;padding:2rem;max-width:400px;width:90%;position:relative;">
      <h2 id="pledge-modal-title" style="margin-top:0;font-size:1.3rem;">Pledge with Bitcoin Cash</h2>
      <label for="pledge-amount" style="display:block;margin-bottom:.4rem;font-weight:500;">
        Amount (BCH)
      </label>
      <input id="pledge-amount" type="number" min="${MIN_PLEDGE_BCH}" step="0.001"
             placeholder="e.g. 0.5"
             style="width:100%;padding:.5rem;font-size:1rem;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;" />
      <div id="pledge-error" role="alert"
           style="color:#c0392b;margin-top:.5rem;font-size:.9rem;min-height:1.2em;"></div>
      <div style="margin-top:1.2rem;display:flex;gap:.75rem;justify-content:flex-end;">
        <button id="pledge-cancel"
                style="background:#aaa;color:#fff;padding:.6rem 1rem;border:none;border-radius:6px;cursor:pointer;">
          Cancel
        </button>
        <button id="pledge-confirm"
                style="background:#2ecc71;color:#fff;padding:.6rem 1rem;border:none;border-radius:6px;cursor:pointer;">
          Confirm Pledge
        </button>
      </div>
    </div>
  `;

  doc.body.appendChild(modal);

  doc.getElementById("pledge-cancel").addEventListener("click", () => {
    closePledgeModal(doc);
    if (typeof onCancel === "function") onCancel();
  });

  doc.getElementById("pledge-confirm").addEventListener("click", () => {
    const rawAmount = doc.getElementById("pledge-amount").value;
    const result = validatePledgeAmount(rawAmount, goalBch);
    const errorEl = doc.getElementById("pledge-error");
    if (!result.valid) {
      errorEl.textContent = result.error;
      return;
    }
    errorEl.textContent = "";
    const uri = buildPaymentUri(recipientAddress, parseFloat(rawAmount));
    closePledgeModal(doc);
    if (typeof onSuccess === "function") onSuccess(uri);
  });
}

/**
 * Close (hide) the pledge modal.
 *
 * @param {Document} [doc] - DOM document (injectable for tests).
 */
function closePledgeModal(doc = document) {
  const modal = doc.getElementById("pledge-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// CommonJS export so the module can be required by Jest.
// In the browser the functions are attached to `window` below.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { validatePledgeAmount, buildPaymentUri, openPledgeModal, closePledgeModal, MIN_PLEDGE_BCH };
} else {
  window.pledgeFlow = { validatePledgeAmount, buildPaymentUri, openPledgeModal, closePledgeModal, MIN_PLEDGE_BCH };
}
