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
export const createGraph = (uids: string[] = [], connections: number = 3) => {
  const ids = uids.sort();
  const graph: { [index: string]: string[] } = {};
  for (let i = 0; i < ids.length; i++) {
    const nodes = ids.slice(
      connections * i + 1,
      connections * i + 1 + connections
    );
    if (nodes.length) graph[ids[i]] = nodes;
  }
  return graph;
};
