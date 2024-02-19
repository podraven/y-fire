var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { doc, getDoc, serverTimestamp, setDoc, getDocs, collection, runTransaction, } from "@firebase/firestore";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as string from "lib0/string";
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
export const initiateInstance = (db, path) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let uid;
        let offset;
        const instanceRef = doc(collection(db, `${path}/instances`));
        const firestoreTimestamp = serverTimestamp();
        const before = Date.now();
        yield setDoc(instanceRef, { now: firestoreTimestamp });
        const after = Date.now();
        // console.log("Instance written", path);
        uid = instanceRef.id;
        const avg = Math.floor((before + after) / 2);
        const instanceDoc = yield getDoc(doc(db, `${path}/instances/${uid}`));
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
export const deleteInstance = (db, path, uid) => __awaiter(void 0, void 0, void 0, function* () {
    // console.log("Destroy instance", path, uid);
    try {
        if (!uid)
            throw `instance id is empty`;
        yield runTransaction(db, (transaction) => __awaiter(void 0, void 0, void 0, function* () {
            const ref = doc(db, `${path}/instances`, uid);
            const callsRef = collection(db, `${path}/instances/${uid}/calls`);
            const answersRef = collection(db, `${path}/instances/${uid}/answers`);
            const calls = yield getDocs(callsRef);
            const answers = yield getDocs(answersRef);
            calls.forEach((call) => {
                const callRef = doc(db, `${path}/instances/${uid}/calls/${call.id}`);
                transaction.delete(callRef);
            });
            answers.forEach((answer) => {
                const answerRef = doc(db, `${path}/instances/${uid}/answers/${answer.id}`);
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
/**
 * Death to peer!
 * We don't know which peer died so each peer should
 * try to kill othe other peer's firestore instance.
 * Whoever successfully kills the other peer, survives.
 */
export const killZombie = (db, path, uid, peerUid) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ref = doc(db, `${path}/instances`, uid);
        const instance = yield getDoc(ref);
        if (instance.exists()) {
            // only proceed if this instance exists
            // else it means that this instance was killed
            // by its peer
            deleteInstance(db, path, peerUid);
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
export const refreshPeers = (newPeers, oldPeers) => {
    const oldMinusNew = Array.from(oldPeers).filter((item) => !newPeers.includes(item));
    const noChange = Array.from(oldPeers).filter((x) => newPeers.includes(x));
    const newMinusOld = newPeers.filter((item) => !oldPeers.has(item));
    return {
        obselete: oldMinusNew,
        same: noChange,
        new: newMinusOld,
    };
};
export const Uint8ArrayToBase64 = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    const base64url = yield new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.readAsDataURL(new Blob([buffer]));
    });
    // remove the `data:...;base64,` part from the start
    const bas64 = base64url;
    return bas64.slice(bas64.indexOf(",") + 1);
});
export const base64ToUint8Array = (base64) => __awaiter(void 0, void 0, void 0, function* () {
    var dataUrl = "data:application/octet-binary;base64," + base64;
    const uint8 = yield fetch(dataUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
    return uint8;
});
export const generateKey = (sender, receiver) => __awaiter(void 0, void 0, void 0, function* () {
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
export const encryptData = (message, key) => __awaiter(void 0, void 0, void 0, function* () {
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
export const decryptData = (message, key) => __awaiter(void 0, void 0, void 0, function* () {
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
