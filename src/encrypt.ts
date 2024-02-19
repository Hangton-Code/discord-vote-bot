import CryptoJS from "crypto-js";
import AES from "crypto-js/aes";
import encUtf8 from "crypto-js/enc-utf8";

// Encryption function
export function encryptText(text, password) {
  const encryptedText = AES.encrypt(text, password).toString();
  return encryptedText;
}

// Decryption function
export function decryptText(encryptedText, password) {
  const decryptedText = AES.decrypt(encryptedText, password).toString(encUtf8);
  return decryptedText;
}
