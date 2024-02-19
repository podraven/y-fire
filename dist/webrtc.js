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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRtc = void 0;
const Y = __importStar(require("yjs"));
const awarenessProtocol = __importStar(require("y-protocols/awareness"));
const firestore_1 = require("@firebase/firestore");
const observable_1 = require("lib0/observable");
const simple_peer_light_1 = __importDefault(require("simple-peer-light"));
const utils_1 = require("./utils");
class WebRtc extends observable_1.ObservableV2 {
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
                    (0, utils_1.killZombie)(this.db, this.documentPath, this.uid, this.peerUid);
                    if (this.peer)
                        this.peer.destroy();
                }
            }, 30 * 1000);
        };
        this.createKey = () => __awaiter(this, void 0, void 0, function* () {
            this.peerKey = yield (0, utils_1.generateKey)(this.isCaller ? this.uid : this.peerUid, this.isCaller ? this.peerUid : this.uid);
            // this.consoleHandler("key", this.peerKey);
            if (!this.peerKey)
                this.destroy();
        });
        this.callPeer = () => {
            this.peer = new simple_peer_light_1.default({
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
                    const callRef = (0, firestore_1.doc)(this.db, `${this.documentPath}/instances/${this.peerUid}/calls`, this.uid);
                    yield (0, firestore_1.setDoc)(callRef, { signal });
                    setTimeout(() => {
                        (0, firestore_1.deleteDoc)(callRef);
                    }, 30 * 1000); // delete call after 30 seconds, if handshake hasn't deleted it yet
                }
                catch (error) {
                    this.errorHandler(error);
                }
            }));
        };
        this.replyPeer = () => {
            this.peer = new simple_peer_light_1.default({
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
                    const answerRef = (0, firestore_1.doc)(this.db, `${this.documentPath}/instances/${this.peerUid}/answers`, this.uid);
                    yield (0, firestore_1.setDoc)(answerRef, { signal });
                    setTimeout(() => {
                        (0, firestore_1.deleteDoc)(answerRef);
                    }, 30 * 1000); // delete call after 30 seconds, if handshake hasn't deleted it yet
                }
                catch (error) {
                    this.errorHandler(error);
                }
            }));
        };
        this.handshake = () => {
            this.unsubscribeHandshake = (0, firestore_1.onSnapshot)((0, firestore_1.doc)(this.db, `${this.documentPath}/instances/${this.uid}/${this.isCaller ? "answers" : "calls"}/${this.peerUid}`), // track own uid not peerUid
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
                    ref = (0, firestore_1.doc)(this.db, `${this.documentPath}/instances/${this.peerUid}/calls`, this.uid);
                }
                else {
                    ref = (0, firestore_1.doc)(this.db, `${this.documentPath}/instances/${this.peerUid}/answers`, this.uid);
                }
                (0, firestore_1.deleteDoc)(ref);
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
                msg.data = yield (0, utils_1.Uint8ArrayToBase64)(data);
            }
            const encrypted = yield (0, utils_1.encryptData)(msg, this.peerKey);
            if (this.connection === "connected" && encrypted)
                this.peer.send(encrypted);
        });
        this.handleReceivingData = (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const decrypted = yield (0, utils_1.decryptData)(data, this.peerKey);
                if (decrypted) {
                    if (decrypted.data) {
                        decrypted.data = yield (0, utils_1.base64ToUint8Array)(decrypted.data);
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
        this.db = (0, firestore_1.getFirestore)(firebaseApp);
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
exports.WebRtc = WebRtc;
