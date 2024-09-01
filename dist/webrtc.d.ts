/// <reference types="node" />
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { FirebaseApp } from "@firebase/app";
import { Firestore } from "@firebase/firestore";
import { ObservableV2 } from "lib0/observable";
import SimplePeer from "simple-peer-light";
interface Parameters {
    firebaseApp: FirebaseApp;
    ydoc: Y.Doc;
    awareness: awarenessProtocol.Awareness;
    instanceConnection: ObservableV2<any>;
    documentPath: string;
    uid: string;
    peerUid: string;
    isCaller: boolean;
}
export declare class WebRtc extends ObservableV2<any> {
    readonly doc: Y.Doc;
    awareness: awarenessProtocol.Awareness;
    instanceConnection: ObservableV2<any>;
    readonly documentPath: string;
    uid: string;
    peerUid: string;
    peer: SimplePeer.Instance;
    readonly db: Firestore;
    private unsubscribeHandshake?;
    isCaller: boolean;
    ice: {
        iceServers: {
            urls: string;
        }[];
    };
    peerKey: CryptoKey;
    connection: string;
    clock: string | number | NodeJS.Timeout;
    idleThreshold: number;
    constructor({ firebaseApp, ydoc, awareness, instanceConnection, documentPath, uid, peerUid, isCaller, }: Parameters);
    initPeer: () => void;
    startInitClock: () => void;
    createKey: () => Promise<void>;
    createPeer: (config: {
        initiator: boolean;
        config: {
            iceServers: {
                urls: string;
            }[];
        };
        trickle: boolean;
        channelName?: string;
    }) => void;
    callPeer: () => void;
    replyPeer: () => void;
    handshake: () => void;
    unsubHandshake: () => void;
    connect: (signal: SimplePeer.SignalData) => void;
    deleteSignals: () => void;
    handleOnConnected: () => void;
    handleOnClose: () => void;
    sendData: ({ message, data, }: {
        message: unknown;
        data: Uint8Array | null;
    }) => Promise<void>;
    handleReceivingData: (data: any) => Promise<void>;
    consoleHandler: (message: any, data?: any) => void;
    errorHandler: (error: any) => void;
    destroy(): Promise<void>;
}
export {};
//# sourceMappingURL=webrtc.d.ts.map