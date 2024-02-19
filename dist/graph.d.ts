/**
 * This function takes an array of connected
 * uids and creates a connection graph. We don't
 * want a client to connect to all clients since it
 * degrade performance, instead we will form clusters
 * of clients.
 * @param uids uids of all connected clients
 * @param connections max number of connections
 * @returns
 */
export declare const createGraph: (uids?: string[], connections?: number) => {
    [index: string]: string[];
};
//# sourceMappingURL=graph.d.ts.map