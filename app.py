from flask import Flask, render_template, request, jsonify
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.exceptions import InvalidTag
import base64
import binascii
import os

app = Flask(__name__)

def encode_package(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii")

def decode_package(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"), altchars=b"-_", validate=True)

def derive_key(passphrase: str, salt: bytes) -> bytes:
    kdf = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1)
    return kdf.derive(passphrase.encode("utf-8"))

@app.get("/")
def index():
    return render_template("index.html")

@app.post("/api/encrypt")
def encrypt_message():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", ""))
    passphrase = str(data.get("passphrase", ""))

    if not message.strip():
        return jsonify(error="Enter a message before encrypting."), 400
    if len(passphrase) < 8:
        return jsonify(error="Use a passphrase with at least 8 characters."), 400

    try:
        salt, nonce = os.urandom(16), os.urandom(12)
        key = derive_key(passphrase, salt)
        encrypted = AESGCM(key).encrypt(nonce, message.encode("utf-8"), None)
        package = b"\x01" + salt + nonce + encrypted
        return jsonify(ciphertext=encode_package(package))
    except Exception:
        app.logger.exception("Encryption failed")
        return jsonify(error="Encryption failed unexpectedly."), 500

@app.post("/api/decrypt")
def decrypt_message():
    data = request.get_json(silent=True) or {}
    ciphertext_text = str(data.get("ciphertext", "")).strip()
    passphrase = str(data.get("passphrase", ""))

    if not ciphertext_text:
        return jsonify(error="Paste the encrypted message first."), 400
    if not passphrase:
        return jsonify(error="Enter the shared passphrase."), 400

    try:
        package = decode_package(ciphertext_text)
        if len(package) < 45 or package[0] != 1:
            return jsonify(error="The encrypted message format is invalid."), 400

        salt, nonce, encrypted = package[1:17], package[17:29], package[29:]
        key = derive_key(passphrase, salt)
        plaintext = AESGCM(key).decrypt(nonce, encrypted, None)
        return jsonify(plaintext=plaintext.decode("utf-8"))
    except (ValueError, InvalidTag, UnicodeDecodeError, binascii.Error):
        return jsonify(error="Decryption failed. Check the passphrase and ciphertext."), 400
    except Exception:
        app.logger.exception("Decryption failed unexpectedly")
        return jsonify(error="Decryption failed unexpectedly."), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
