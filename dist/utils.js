"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptData = exports.encryptData = exports.generateKey = exports.base64ToUint8Array = exports.Uint8ArrayToBase64 = exports.refreshPeers = exports.killZombie = exports.deleteInstance = exports.initiateInstance = void 0;
const firestore_1 = require("@firebase/firestore");
const encoding = __importStar(require("lib0/encoding"));
const decoding = __importStar(require("lib0/decoding"));
const string = __importStar(require("lib0/string"));
/**
 * initiateInstance does the following:
 * 1. Writes server time into a document
 * 2. This makes sure we get the servertime
 *    and makes sure that this user has write
 *    permission in this document path
 * 3. After writing to Firebase, we retrieve the id
 *    of this newly created document, which we will
 *    use as an id for this client connection
 * @param db
 * @param path
 * @returns
 */
const initiateInstance = (db, path) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let uid;
        let offset;
        const instanceRef = (0, firestore_1.doc)((0, firestore_1.collection)(db, `${path}/instances`));
        const firestoreTimestamp = (0, firestore_1.serverTimestamp)();
        const before = Date.now();
        yield (0, firestore_1.setDoc)(instanceRef, { now: firestoreTimestamp });
        const after = Date.now();
        // console.log("Instance written", path);
        uid = instanceRef.id;
        const avg = Math.floor((before + after) / 2);
        const instanceDoc = yield (0, firestore_1.getDoc)((0, firestore_1.doc)(db, `${path}/instances/${uid}`));
        if (!instanceDoc.exists())
            throw `instance not created`;
        const instanceData = instanceDoc.data();
        const serverTime = instanceData.now;
        offset =
            serverTime.seconds * 1000 +
                Math.floor(serverTime.nanoseconds / 1000000) -
                avg;
        return { uid, offset };
    }
    catch (error) {
        throw error;
    }
});
exports.initiateInstance = initiateInstance;
// export const recreateInstance = async (
//   db: Firestore,
//   path: string,
//   uid: string
// ) => {
//   await deleteInstance(db, path, uid);
//   return await initiateInstance(db, path);
// };
/**
 *
 * @param db
 * @param path
 * @param uid
 */
const deleteInstance = (db, path, uid) => __awaiter(void 0, void 0, void 0, function* () {
    // console.log("Destroy instance", path, uid);
    try {
        if (!uid)
            throw `instance id is empty`;
        yield (0, firestore_1.runTransaction)(db, (transaction) => __awaiter(void 0, void 0, void 0, function* () {
            const ref = (0, firestore_1.doc)(db, `${path}/instances`, uid);
            const callsRef = (0, firestore_1.collection)(db, `${path}/instances/${uid}/calls`);
            const answersRef = (0, firestore_1.collection)(db, `${path}/instances/${uid}/answers`);
            const calls = yield (0, firestore_1.getDocs)(callsRef);
            const answers = yield (0, firestore_1.getDocs)(answersRef);
            calls.forEach((call) => {
                const callRef = (0, firestore_1.doc)(db, `${path}/instances/${uid}/calls/${call.id}`);
                transaction.delete(callRef);
            });
            answers.forEach((answer) => {
                const answerRef = (0, firestore_1.doc)(db, `${path}/instances/${uid}/answers/${answer.id}`);
                transaction.delete(answerRef);
            });
            transaction.delete(ref);
        }));
        // return { success: true };
    }
    catch (error) {
        // console.log(path, "Delete instance error:", error);
        // return { success: false, error };
    }
});
exports.deleteInstance = deleteInstance;
/**
 * Death to peer!
 * We don't know which peer died so each peer should
 * try to kill othe other peer's firestore instance.
 * Whoever successfully kills the other peer, survives.
 */
const killZombie = (db, path, uid, peerUid) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ref = (0, firestore_1.doc)(db, `${path}/instances`, uid);
        const instance = yield (0, firestore_1.getDoc)(ref);
        if (instance.exists()) {
            // only proceed if this instance exists
            // else it means that this instance was killed
            // by its peer
            (0, exports.deleteInstance)(db, path, peerUid);
        }
        // return {
        //   success: true,
        // };
    }
    catch (error) {
        // console.log("Kill zombie error:", error);
        // return {
        //   success: false,
        //   error,
        // };
    }
});
exports.killZombie = killZombie;
const refreshPeers = (newPeers, oldPeers) => {
    const oldMinusNew = Array.from(oldPeers).filter((item) => !newPeers.includes(item));
    const noChange = Array.from(oldPeers).filter((x) => newPeers.includes(x));
    const newMinusOld = newPeers.filter((item) => !oldPeers.has(item));
    return {
        obselete: oldMinusNew,
        same: noChange,
        new: newMinusOld,
    };
};
exports.refreshPeers = refreshPeers;
const Uint8ArrayToBase64 = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    const base64url = yield new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.readAsDataURL(new Blob([buffer]));
    });
    // remove the `data:...;base64,` part from the start
    const bas64 = base64url;
    return bas64.slice(bas64.indexOf(",") + 1);
});
exports.Uint8ArrayToBase64 = Uint8ArrayToBase64;
const base64ToUint8Array = (base64) => __awaiter(void 0, void 0, void 0, function* () {
    var dataUrl = "data:application/octet-binary;base64," + base64;
    const uint8 = yield fetch(dataUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
    return uint8;
});
exports.base64ToUint8Array = base64ToUint8Array;
const generateKey = (sender, receiver) => __awaiter(void 0, void 0, void 0, function* () {
    const secretBuffer = string.encodeUtf8(sender).buffer;
    const salt = string.encodeUtf8(receiver).buffer;
    const key = yield crypto.subtle
        .importKey("raw", secretBuffer, "PBKDF2", false, ["deriveKey"])
        .then((keyMaterial) => crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
    }, keyMaterial, {
        name: "AES-GCM",
        length: 256,
    }, true, ["encrypt", "decrypt"]));
    return key;
});
exports.generateKey = generateKey;
const encryptData = (message, key) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const string = JSON.stringify(message); // convert obj to string
        const encoder = new TextEncoder(); // convert string to uint8array
        const data = encoder.encode(string);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = yield crypto.subtle.encrypt({
            name: "AES-GCM",
            iv: iv,
        }, key, data);
        const encryptedDataEncoder = encoding.createEncoder();
        encoding.writeVarString(encryptedDataEncoder, "AES-GCM");
        encoding.writeVarUint8Array(encryptedDataEncoder, iv);
        encoding.writeVarUint8Array(encryptedDataEncoder, new Uint8Array(cipher));
        return encoding.toUint8Array(encryptedDataEncoder);
    }
    catch (error) {
        return null;
    }
});
exports.encryptData = encryptData;
const decryptData = (message, key) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dataDecoder = decoding.createDecoder(message);
        const algorithm = decoding.readVarString(dataDecoder);
        if (algorithm !== "AES-GCM")
            throw `Unknown algorithm`;
        const iv = decoding.readVarUint8Array(dataDecoder);
        const cipher = decoding.readVarUint8Array(dataDecoder);
        const decrypted = yield crypto.subtle.decrypt({
            name: "AES-GCM",
            iv,
        }, key, cipher);
        // console.log("Decrypted", decrypted);
        const decoder = new TextDecoder();
        const data = decoder.decode(decrypted); // convert uint8array to string
        const obj = JSON.parse(data);
        return obj;
    }
    catch (error) {
        // console.log("Decrypt error", error);
        return null;
    }
});
exports.decryptData = decryptData;
