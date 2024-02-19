var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc, } from "@firebase/firestore";
import { ObservableV2 } from "lib0/observable";
import SimplePeer from "simple-peer-light";
import { Uint8ArrayToBase64, base64ToUint8Array, decryptData, encryptData, generateKey, killZombie, } from "./utils";
export class WebRtc extends ObservableV2 {
    constructor({ firebaseApp, ydoc, awareness, instanceConnection, documentPath, uid, peerUid, isCaller = false, }) {
        super();
        this.ice = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ],
        };
        this.connection = "connecting";
        this.initPeer = () => {
            this.createKey();
            if (this.isCaller) {
                this.callPeer();
            }
            else {
                this.replyPeer();
            }
            this.peer.on("data", this.handleReceivingData);
            this.handshake();
            this.peer.on("connect", this.handleOnConnected);
            this.peer.on("close", this.handleOnClose);
            this.startInitClock();
        };
        this.startInitClock = () => {
            /**
             * We will track how long it takes to connect to this peer
             * if it takes longer than 30s, we assume that we are
             * connected to a zombie peer. Thus we will attempt to
             * kill the zombie instance
             */
            if (this.clock)
                clearTimeout(this.clock);
            this.clock = setTimeout(() => {
                if (this.connection !== "connected") {
                    killZombie(this.db, this.documentPath, this.uid, this.peerUid);
                    if (this.peer)
                        this.peer.destroy();
                }
            }, 30 * 1000);
        };
        this.createKey = () => __awaiter(this, void 0, void 0, function* () {
            this.peerKey = yield generateKey(this.isCaller ? this.uid : this.peerUid, this.isCaller ? this.peerUid : this.uid);
            // this.consoleHandler("key", this.peerKey);
            if (!this.peerKey)
                this.destroy();
        });
        this.callPeer = () => {
            this.peer = new SimplePeer({
                initiator: true,
                config: this.ice,
                trickle: false,
                channelName: `${this.documentPath}:${this.uid}_${this.peerUid}`,
            });
            this.peer.on("signal", (signal) => __awaiter(this, void 0, void 0, function* () {
                /**
                 * Write signal to ./instances/{peerUid}/calls/{uid}
                 */
                // this.consoleHandler("Send call to peer");
                try {
                    const callRef = doc(this.db, `${this.documentPath}/instances/${this.peerUid}/calls`, this.uid);
                    yield setDoc(callRef, { signal });
                    setTimeout(() => {
                        deleteDoc(callRef);
                    }, 30 * 1000); // delete call after 30 seconds, if handshake hasn't deleted it yet
                }
                catch (error) {
                    this.errorHandler(error);
                }
            }));
        };
        this.replyPeer = () => {
            this.peer = new SimplePeer({
                initiator: false,
                config: this.ice,
                trickle: false,
            });
            this.peer.on("signal", (signal) => __awaiter(this, void 0, void 0, function* () {
                /**
                 * Write signal to ./instances/{peerUid}
                 */
                // this.consoleHandler("Reply with answer");
                try {
                    const answerRef = doc(this.db, `${this.documentPath}/instances/${this.peerUid}/answers`, this.uid);
                    yield setDoc(answerRef, { signal });
                    setTimeout(() => {
                        deleteDoc(answerRef);
                    }, 30 * 1000); // delete call after 30 seconds, if handshake hasn't deleted it yet
                }
                catch (error) {
                    this.errorHandler(error);
                }
            }));
        };
        this.handshake = () => {
            this.unsubscribeHandshake = onSnapshot(doc(this.db, `${this.documentPath}/instances/${this.uid}/${this.isCaller ? "answers" : "calls"}/${this.peerUid}`), // track own uid not peerUid
            (doc) => {
                const docData = doc.data();
                if (docData) {
                    // this.consoleHandler("handshake");
                    this.connect(docData.signal);
                }
            }, (error) => {
                // this.consoleHandler("handshake error", error);
            });
        };
        this.unsubHandshake = () => {
            if (this.unsubscribeHandshake) {
                this.unsubscribeHandshake();
                delete this.unsubscribeHandshake;
            }
        };
        this.connect = (signal) => {
            try {
                this.unsubHandshake(); // we already have a handshake, stop further handshakes
                if (this.peer)
                    this.peer.signal(signal);
                this.deleteSignals(); // Delete calls and answers docs because we already have a handshake
            }
            catch (error) {
                this.errorHandler(error);
            }
        };
        this.deleteSignals = () => {
            try {
                let ref;
                if (this.isCaller) {
                    ref = doc(this.db, `${this.documentPath}/instances/${this.peerUid}/calls`, this.uid);
                }
                else {
                    ref = doc(this.db, `${this.documentPath}/instances/${this.peerUid}/answers`, this.uid);
                }
                deleteDoc(ref);
            }
            catch (error) {
                // this.consoleHandler("delete signals error", error);
            }
        };
        this.handleOnConnected = () => {
            // this.consoleHandler("Peer connected");
            this.connection = "connected";
            this.sendData({ message: "Hey!", data: null });
        };
        this.handleOnClose = () => {
            // this.consoleHandler("Peer disconnected");
            this.connection = "closed";
            this.instanceConnection.emit("closed", [true]);
            this.destroy();
        };
        this.sendData = ({ message, data, }) => __awaiter(this, void 0, void 0, function* () {
            const msg = {};
            msg.uid = this.uid;
            if (message)
                msg.message = message;
            if (data) {
                msg.data = yield Uint8ArrayToBase64(data);
            }
            const encrypted = yield encryptData(msg, this.peerKey);
            if (this.connection === "connected" && encrypted)
                this.peer.send(encrypted);
        });
        this.handleReceivingData = (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const decrypted = yield decryptData(data, this.peerKey);
                if (decrypted) {
                    if (decrypted.data) {
                        decrypted.data = yield base64ToUint8Array(decrypted.data);
                    }
                    if (decrypted.message === "awareness" && decrypted.data) {
                        awarenessProtocol.applyAwarenessUpdate(this.awareness, decrypted.data, decrypted.uid);
                    }
                    else if (!decrypted.message && decrypted.data) {
                        // this.consoleHandler("decrypted data", decrypted);
                        Y.applyUpdate(this.doc, decrypted.data, decrypted.uid);
                    }
                }
            }
            catch (error) {
                this.errorHandler(error);
            }
        });
        this.consoleHandler = (message, data = null) => {
            console.log("WebRTC", this.documentPath, `this client: ${this.uid}`, `peer client: ${this.peerUid}`, message, data);
        };
        this.errorHandler = (error) => {
            this.consoleHandler("Error", error);
        };
        this.doc = ydoc;
        this.awareness = awareness;
        this.instanceConnection = instanceConnection;
        this.documentPath = documentPath;
        this.uid = uid;
        this.peerUid = peerUid;
        this.db = getFirestore(firebaseApp);
        this.isCaller = isCaller;
        /**
         * Let's initiate this peer. The peer
         * is NOT a caller unless specified
         */
        // this.consoleHandler("Peer initiated");
        this.initPeer();
    }
    destroy() {
        const _super = Object.create(null, {
            destroy: { get: () => super.destroy }
        });
        return __awaiter(this, void 0, void 0, function* () {
            // this.consoleHandler("destroyed");
            if (this.clock)
                clearTimeout(this.clock);
            if (this.peer)
                this.peer.destroy();
            this.unsubHandshake();
            this.deleteSignals(); // Delete calls and answers
            _super.destroy.call(this);
        });
    }
}
