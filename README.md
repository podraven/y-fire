# y-fire

A database and connection provider for Yjs based on Firestore.

y-fire is a Firestore (Firebase) and WebRTC-based provider, built especially for serverless infrastructure, that offers real-time capabilities to your Yjs-based applications. y-fire is built with efficiency in mind to reduce the number of calls that the application makes to and from Firestore. With y-fire, Firestore will act as both 1. persistent storage and 2. a peer discovery platform for WebRTC connections. This means that real-time updates are shared through a peer-to-peer network, thus reducing connections to Firestore. y-fire was inspired by [yjs-firestore-provider](https://github.com/gmcfall/yjs-firestore-provider) but implements few things differently.

# Features

1. Utilizes a peer-to-peer network to exchange real-time data and awareness.
2. Utilizes Firestore as persistent storage and syncs with Firestore periodically to maintain persistent data state.
3. Utilizes Firestore as a peer discovery platform. Once peers are connected to each other, real-time updates are shared without accessing Firestore, thus reducing costs.
4. Instead of connecting all peers to each other, y-fire creates clusters of clients. Clients within a cluster are connected to each other, and clusters are connected to each other through one common client. If clients leave or new clients join, clusters are recreated. Limiting client connections to limited number of peers thus improves performance. (Discussion: [WebRTC: peer connections limit](https://stackoverflow.com/questions/16015304/webrtc-peer-connections-limit))
5. You can set wait times and thresholds.

# Installation

#### Prerequisites:

Make sure you have the following dependencies already installed in your project (skip the following steps if you already have these installed):

```
npm install yjs firebase --save
```

Some editor bindings, including `y-prosemirror`, `TipTap`, and `y-quill`, have an explicit dependency on the `y-protocols` module. If you are using one of these bindings, you don't need to install `y-protocols` separately.

```
npm install y-protocols --save
```

#### Install y-fire

Once you have installed all the dependencies, you can install the `y-fire` library:

```
npm install y-fire --save
```

# Usage

```
import * as Y from "yjs";
import { FireProvider } from "y-fire";
import { app } from "path-to-firebase-client";  // ex. app = initializeApp(config)

export const yProvider = (documentPath) => {
  const firebaseApp = app;
  const ydoc = new Y.Doc();
  return new FireProvider({ firebaseApp, ydoc, path: documentPath });
};
```

Tiptap example:

```
const provider = yProvider("path/to/your/firestore/document");

provider.onReady = () => {
  // do something
};
provider.onDeleted = () => {
  // do something
};
provider.onSaving = (status) => {
  // do something
};

...

const editor = new Editor({
  extensions: [
    StarterKit.configure({
      // The Collaboration extension comes with its own history handling
      history: false,
    }),
    // Register the document with Tiptap
    Collaboration.configure({
      document: provider.doc,
    })
    // Register the collaboration cursor extension
    CollaborationCursor.configure({
        provider,
        user: {
            name: "username",
            color: "some color"	// color implementation based on username?
        }
    })
  ],
})
```

# Firestore rules

You need to grant **read and write** permissions to the document `/path/to/your/document` and its children `/path/to/your/document/{document=**}` for this module to function properly. y-fire will write (merge) to the `content` field of your document, which corresponds to your Yjs data. Additionally, y-fire creates collections and documents within the specified document path for peer discovery purposes.

# APIs

#### Configuration

- **firebaseApp**: FirebaseApp (required)
- **ydoc**: Y.Doc (required)
- **path**: path to your **document** (required) ex. users/username/tasks/task-1
- **maxUpdatesThreshold**: Number of updates before triggering real-time data share, defaults to 20
- **maxWaitTime**: Time in milliseconds before triggering real-time data share, defaults to 100
- **maxWaitFirestoreTime**: Time in milliseconds before triggering persistent data sync to Firestore, defaults to 3000

Example:

```
new FireProvider({
  firebaseApp,
  ydoc,
  path: "username/tasks/taskuid",
  maxUpdatesThreshold: 10,
  maxWaitTime: 90,
  maxWaitFirestoreTime: 500
});
```

#### Methods

- **destroyHandler**: Destroys the y-fire instance. You may want to destroy the y-fire instance when navigating out of the page to avoid the initialization of duplicate instances. Use `provider.destroyHandler();` to destroy the instance.

#### Events

- **onReady**: Triggered after the first connection has been established to Firestore (initial data fetch).
- **onDeleted**: Triggered if the instance was deleted (e.g., no permission to read/write the document).
- **onSaving**: Triggered when the sync to Firestore is in process (e.g., you may want to alert users not to close the window).

Example:

```
provider.onReady = () => {
  // do something
};
```

[1.1]: http://i.imgur.com/wWzX9uB.png "twitter icon without padding"

# Contributors

Made possible by **[Pod Raven](https://podraven.com)**, with special contributions from: **[deathg0d](https://github.com/deathg0d)**, **[dorkysamurai](https://github.com/lachana)**, **[arbitraryvector](https://x.com/arbitraryvector)**

##### Follow Us

- [![alt text][1.1] @pod_raven](https://x.com/pod_raven)
- [![alt text][1.1] @arbitraryvector](https://x.com/arbitraryvector)

# Licensing and Attribution

This module is licensed under the MIT License. You are generally free to reuse or extend upon this code as you see fit. Just include copies of the [y-fire](https://github.com/podraven/y-fire/blob/main/LICENSE) license.
