const $ = (id) => document.getElementById(id);

function setStatus(id, message, kind = "") {
  const node = $(id);
  node.textContent = message;
  node.className = "status" + (kind ? ` ${kind}` : "");
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Unexpected server response (HTTP ${response.status}). Check the Flask terminal.`);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

function updateCount(inputId, outputId) {
  const length = $(inputId).value.length;
  $(outputId).textContent = `${length.toLocaleString()} character${length === 1 ? "" : "s"}`;
}
$("plain").addEventListener("input", () => updateCount("plain", "plainCount"));
$("cipherInput").addEventListener("input", () => updateCount("cipherInput", "cipherCount"));

$("encryptBtn").addEventListener("click", async () => {
  const button = $("encryptBtn");
  button.disabled = true;
  $("cipher").value = "";
  $("plainOutput").value = "";
  setStatus("encryptStatus", "Encrypting message…");
  try {
    const result = await postJson("/api/encrypt", {
      message: $("plain").value,
      passphrase: $("keyA").value
    });
    $("cipher").value = result.ciphertext;
    $("cipherInput").value = result.ciphertext;
    updateCount("cipherInput", "cipherCount");
    $("keyB").value = "";
    setStatus("encryptStatus", "Encrypted successfully. Ciphertext is ready for User B.", "success");
    setStatus("decryptStatus", "Ciphertext received. Enter the shared passphrase to decrypt.");
  } catch (error) {
    setStatus("encryptStatus", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

$("decryptBtn").addEventListener("click", async () => {
  const button = $("decryptBtn");
  button.disabled = true;
  $("plainOutput").value = "";
  setStatus("decryptStatus", "Verifying and decrypting…");
  try {
    const result = await postJson("/api/decrypt", {
      ciphertext: $("cipherInput").value,
      passphrase: $("keyB").value
    });
    $("plainOutput").value = result.plaintext;
    setStatus("decryptStatus", "Decrypted successfully. Message integrity verified.", "success");
  } catch (error) {
    setStatus("decryptStatus", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

async function copyText(value, statusId, successMessage) {
  if (!value) {
    setStatus(statusId, "There is no text to copy yet.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    setStatus(statusId, successMessage, "success");
  } catch {
    setStatus(statusId, "Clipboard access was blocked. Select the text and press Ctrl+C.");
  }
}
$("copyBtn").addEventListener("click", () => copyText($("cipher").value, "encryptStatus", "Encrypted output copied."));
$("copyPlainBtn").addEventListener("click", () => copyText($("plainOutput").value, "decryptStatus", "Original message copied."));

$("sendToBBtn").addEventListener("click", () => {
  if (!$("cipher").value) {
    setStatus("encryptStatus", "Encrypt a message first.", "error");
    return;
  }
  $("cipherInput").value = $("cipher").value;
  updateCount("cipherInput", "cipherCount");
  setStatus("decryptStatus", "Ciphertext transferred. Enter the shared passphrase.");
  $("keyB").focus({ preventScroll: true });
});

$("clearBBtn").addEventListener("click", () => {
  $("cipherInput").value = "";
  $("keyB").value = "";
  $("plainOutput").value = "";
  updateCount("cipherInput", "cipherCount");
  setStatus("decryptStatus", "Recipient workspace cleared.");
});

document.querySelectorAll(".reveal").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.textContent = reveal ? "Hide" : "Show";
  });
});
