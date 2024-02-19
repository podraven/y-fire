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
exports.FireProvider = void 0;
const firestore_1 = require("@firebase/firestore");
const firestore_2 = require("firebase/firestore");
const Y = __importStar(require("yjs"));
const observable_1 = require("lib0/observable");
const awarenessProtocol = __importStar(require("y-protocols/awareness"));
const utils_1 = require("./utils");
const webrtc_1 = require("./webrtc");
const graph_1 = require("./graph");
/**
 * FireProvider class that handles firestore data sync and awareness
 * based on webRTC.
 * @param firebaseApp Firestore instance
 * @param ydoc ydoc
 * @param path path to the firestore document (ex. collection/documentuid)
 * @param maxUpdatesThreshold maximum number of updates to wait for before sending updates to peers
 * @param maxWaitTime maximum miliseconds to wait before sending updates to peers
 * @param maxWaitFirestoreTime miliseconds to wait before syncing this client's update to firestore
 */
class FireProvider extends observable_1.ObservableV2 {
    get clientTimeOffset() {
        return this.timeOffset;
    }
    constructor({ firebaseApp, ydoc, path, maxUpdatesThreshold, maxWaitTime, maxWaitFirestoreTime, }) {
        super();
        this.timeOffset = 0; // offset to server time in mili seconds
        this.clients = [];
        this.peersReceivers = new Set([]);
        this.peersSenders = new Set([]);
        this.peersRTC = {
            receivers: {},
            senders: {},
        };
        this.maxCacheUpdates = 20;
        this.cacheUpdateCount = 0;
        this.maxRTCWait = 100;
        this.maxFirestoreWait = 3000;
        this.firebaseDataLastUpdatedAt = new Date().getTime();
        this.instanceConnection = new observable_1.ObservableV2();
        this.ready = false;
        this.init = () => __awaiter(this, void 0, void 0, function* () {
            this.trackData(); // initiate this before creating instance, so that users with read permissions can also view the document
            try {
                const data = yield (0, utils_1.initiateInstance)(this.db, this.documentPath);
                this.instanceConnection.on("closed", this.trackConnections);
                this.uid = data.uid;
                this.timeOffset = data.offset;
                this.initiateHandler();
                addEventListener("beforeunload", this.destroy); // destroy instance on window close
            }
            catch (error) {
                this.consoleHandler("Could not connect to a peer network.");
                this.kill(true); // destroy provider but keep the read-only stream alive
            }
        });
        this.initiateHandler = () => {
            this.consoleHandler("FireProvider initiated!");
            this.awareness.on("update", this.awarenessUpdateHandler);
            // We will track the mesh document on Firestore to
            // keep track of selected peers
            this.trackMesh();
            this.doc.on("update", this.updateHandler);
        };
        this.trackData = () => {
            // Whenever there are changes to the firebase document
            // pull the changes and merge them to the current
            // yjs document
            if (this.unsubscribeData)
                this.unsubscribeData();
            this.unsubscribeData = (0, firestore_1.onSnapshot)((0, firestore_1.doc)(this.db, this.documentPath), (doc) => {
                if (doc.exists()) {
                    const data = doc.data();
                    if (data && data.content) {
                        this.firebaseDataLastUpdatedAt = new Date().getTime();
                        const content = data.content.toUint8Array();
                        const origin = "origin:firebase/update"; // make sure this does not coincide with UID
                        Y.applyUpdate(this.doc, content, origin);
                    }
                    if (!this.ready) {
                        if (this.onReady) {
                            this.onReady();
                            this.ready = true;
                        }
                    }
                }
            }, (error) => {
                this.consoleHandler("Firestore sync error", error);
                if (error.code === "permission-denied") {
                    if (this.onDeleted)
                        this.onDeleted();
                }
            });
        };
        this.trackMesh = () => {
            if (this.unsubscribeMesh)
                this.unsubscribeMesh();
            this.unsubscribeMesh = (0, firestore_1.onSnapshot)((0, firestore_2.collection)(this.db, `${this.documentPath}/instances`), (snapshot) => {
                this.clients = [];
                snapshot.forEach((doc) => {
                    this.clients.push(doc.id);
                });
                const mesh = (0, graph_1.createGraph)(this.clients);
                // a -> b, c; a is the sender and b, c are receivers
                const receivers = mesh[this.uid]; // this user's receivers
                const senders = Object.keys(mesh).filter((v, i) => mesh[v] && mesh[v].length && mesh[v].includes(this.uid)); // this user's senders
                this.peersReceivers = this.connectToPeers(receivers, this.peersReceivers, true);
                this.peersSenders = this.connectToPeers(senders, this.peersSenders, false);
            }, (error) => {
                this.consoleHandler("Creating peer mesh error", error);
            });
        };
        this.reconnect = () => {
            if (this.recreateTimeout)
                clearTimeout(this.recreateTimeout);
            this.recreateTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                this.consoleHandler("triggering reconnect");
                this.destroy();
                this.init();
            }), 200);
        };
        this.trackConnections = () => __awaiter(this, void 0, void 0, function* () {
            const clients = this.clients.length;
            let connected = 0;
            Object.values(this.peersRTC.receivers).forEach((receiver) => {
                if (receiver.connection !== "closed")
                    connected++;
            });
            Object.values(this.peersRTC.senders).forEach((sender) => {
                if (sender.connection !== "closed")
                    connected++;
            });
            if (clients > 1 && connected <= 0) {
                // we have lost connection with all peers
                // trigger re-generation of the graph/mesh
                this.reconnect();
            }
        });
        this.connectToPeers = (newPeers, oldPeers, isCaller) => {
            if (!newPeers)
                return new Set([]);
            // We must:
            // 1. remove obselete peers
            // 2. add new peers
            // 3. no change to same peers
            const getNewPeers = (0, utils_1.refreshPeers)(newPeers, oldPeers);
            const peersType = isCaller ? "receivers" : "senders";
            if (!this.peersRTC[peersType])
                this.peersRTC[peersType] = {};
            if (getNewPeers.obselete && getNewPeers.obselete.length) {
                // Old peers, remove them
                getNewPeers.obselete.forEach((peerUid) => __awaiter(this, void 0, void 0, function* () {
                    if (this.peersRTC[peersType][peerUid]) {
                        yield this.peersRTC[peersType][peerUid].destroy();
                        delete this.peersRTC[peersType][peerUid];
                    }
                }));
            }
            if (getNewPeers.new && getNewPeers.new.length) {
                // New peers, initiate new connection to them
                getNewPeers.new.forEach((peerUid) => __awaiter(this, void 0, void 0, function* () {
                    if (this.peersRTC[peersType][peerUid]) {
                        yield this.peersRTC[peersType][peerUid].destroy();
                        delete this.peersRTC[peersType][peerUid];
                    }
                    this.peersRTC[peersType][peerUid] = new webrtc_1.WebRtc({
                        firebaseApp: this.firebaseApp,
                        ydoc: this.doc,
                        awareness: this.awareness,
                        instanceConnection: this.instanceConnection,
                        documentPath: this.documentPath,
                        uid: this.uid,
                        peerUid,
                        isCaller,
                    });
                }));
            }
            return new Set(newPeers);
        };
        this.sendDataToPeers = ({ from, message, data, }) => {
            if (this.peersRTC) {
                if (this.peersRTC.receivers) {
                    Object.keys(this.peersRTC.receivers).forEach((receiver) => {
                        if (receiver !== from) {
                            const rtc = this.peersRTC.receivers[receiver];
                            rtc.sendData({ message, data });
                        }
                    });
                }
                if (this.peersRTC.senders) {
                    Object.keys(this.peersRTC.senders).forEach((sender) => {
                        if (sender !== from) {
                            const rtc = this.peersRTC.senders[sender];
                            rtc.sendData({ message, data });
                        }
                    });
                }
            }
        };
        this.saveToFirestore = () => {
            try {
                // current document to firestore
                const ref = (0, firestore_1.doc)(this.db, this.documentPath);
                (0, firestore_1.setDoc)(ref, { content: firestore_1.Bytes.fromUint8Array(Y.encodeStateAsUpdate(this.doc)) }, { merge: true });
            }
            catch (error) {
                this.consoleHandler("error saving to firestore", error);
            }
            finally {
                if (this.onSaving)
                    this.onSaving(false);
            }
        };
        this.sendToFirestoreQueue = () => {
            // if cache settles down, save document to firebase
            if (this.firestoreTimeout)
                clearTimeout(this.firestoreTimeout); // kill other save processes first
            if (this.onSaving)
                this.onSaving(true);
            this.firestoreTimeout = setTimeout(() => {
                if (new Date().getTime() - this.firebaseDataLastUpdatedAt >
                    this.maxFirestoreWait) {
                    this.saveToFirestore();
                }
                else {
                    // A peer recently saved to firebase, let's wait a bit
                    this.sendToFirestoreQueue();
                }
            }, this.maxFirestoreWait);
        };
        this.sendCache = (from) => {
            this.sendDataToPeers({
                from,
                message: null,
                data: this.cache,
            });
            this.cache = null;
            this.cacheUpdateCount = 0;
            this.sendToFirestoreQueue(); // save to firestore
        };
        this.sendToQueue = ({ from, update }) => {
            if (from === this.uid) {
                // this update was from this user
                if (this.cacheTimeout)
                    clearTimeout(this.cacheTimeout);
                this.cache = this.cache ? Y.mergeUpdates([this.cache, update]) : update;
                this.cacheUpdateCount++;
                if (this.cacheUpdateCount >= this.maxCacheUpdates) {
                    // if the cache was already merged 20 times (this.maxCacheUpdates), send
                    // the updates in cache to the peers
                    this.sendCache(from);
                }
                else {
                    // Wait to see if the user make other changes
                    // if the user does not make changes for the next 500ms
                    // send updates in cache to the peers
                    this.cacheTimeout = setTimeout(() => {
                        this.sendCache(from);
                    }, this.maxRTCWait);
                }
            }
            else {
                // this update was from a peer, not this user
                this.sendDataToPeers({
                    from,
                    message: null,
                    data: update,
                });
            }
        };
        this.updateHandler = (update, origin) => {
            if (origin !== this.uid) {
                // Only allow updates typed by the user, and updates sent by peers
                // Disallow repeat updates that were sent back by the peers
                Y.applyUpdate(this.doc, update, this.uid); // the third parameter sets the transaction-origin
                this.sendToQueue({
                    from: typeof origin === "string" ? origin : this.uid,
                    update,
                });
            }
        };
        this.awarenessUpdateHandler = ({ added, updated, removed, }, origin) => {
            const changedClients = added.concat(updated).concat(removed);
            this.sendDataToPeers({
                from: origin !== "local" ? origin : this.uid,
                message: "awareness",
                data: awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
            });
        };
        this.consoleHandler = (message, data = null) => {
            console.log("Provider:", this.documentPath, `this client: ${this.uid}`, message, data);
        };
        // use destroy directly if you don't need arguements
        // otherwise use kill
        this.destroy = () => {
            // we have to create a separate function here
            // because beforeunload only takes this.destroy
            // and not this.destroy() or with this.destroy(args)
            this.kill();
        };
        this.kill = (keepReadOnly = false) => {
            this.instanceConnection.destroy();
            removeEventListener("beforeunload", this.destroy);
            if (this.recreateTimeout)
                clearTimeout(this.recreateTimeout);
            if (this.cacheTimeout)
                clearTimeout(this.cacheTimeout);
            if (this.firestoreTimeout)
                clearTimeout(this.firestoreTimeout);
            this.doc.off("update", this.updateHandler);
            this.awareness.off("update", this.awarenessUpdateHandler);
            (0, utils_1.deleteInstance)(this.db, this.documentPath, this.uid);
            if (this.unsubscribeData && !keepReadOnly) {
                this.unsubscribeData();
                delete this.unsubscribeData;
            }
            if (this.unsubscribeMesh) {
                this.unsubscribeMesh();
                delete this.unsubscribeMesh;
            }
            if (this.peersRTC) {
                if (this.peersRTC.receivers) {
                    Object.values(this.peersRTC.receivers).forEach((receiver) => receiver.destroy());
                }
                if (this.peersRTC.senders) {
                    Object.values(this.peersRTC.senders).forEach((sender) => sender.destroy());
                }
            }
            this.ready = false;
            super.destroy();
        };
        // Initializing values
        this.firebaseApp = firebaseApp;
        this.db = (0, firestore_1.getFirestore)(this.firebaseApp);
        this.doc = ydoc;
        this.documentPath = path;
        if (maxUpdatesThreshold)
            this.maxCacheUpdates = maxUpdatesThreshold;
        if (maxWaitTime)
            this.maxRTCWait = maxWaitTime;
        if (maxWaitFirestoreTime)
            this.maxFirestoreWait = maxWaitFirestoreTime;
        this.awareness = new awarenessProtocol.Awareness(this.doc);
        // Initialize the provider
        const init = this.init();
        this.destroyHandler = () => {
            this.destroy();
        };
    }
}
exports.FireProvider = FireProvider;
