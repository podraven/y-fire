import { Firestore } from "@firebase/firestore";
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
export declare const initiateInstance: (db: Firestore, path: string) => Promise<{
    uid: string;
    offset: number;
}>;
/**
 *
 * @param db
 * @param path
 * @param uid
 */
export declare const deleteInstance: (db: Firestore, path: string, uid: string) => Promise<void>;
/**
 * Death to peer!
 * We don't know which peer died so each peer should
 * try to kill othe other peer's firestore instance.
 * Whoever successfully kills the other peer, survives.
 */
export declare const killZombie: (db: Firestore, path: string, uid: string, peerUid: string) => Promise<void>;
export declare const refreshPeers: (newPeers: string[], oldPeers: Set<string>) => {
    obselete: string[];
    same: string[];
    new: string[];
};
export declare const Uint8ArrayToBase64: (buffer: Uint8Array) => Promise<string>;
export declare const base64ToUint8Array: (base64: string) => Promise<Uint8Array>;
export declare const generateKey: (sender: string, receiver: string) => Promise<CryptoKey>;
export declare const encryptData: (message: any, key: CryptoKey) => Promise<Uint8Array>;
export declare const decryptData: (message: Uint8Array, key: CryptoKey) => Promise<any>;
//# sourceMappingURL=utils.d.ts.map