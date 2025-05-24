export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  gasCacheTtl: parseInt(process.env.GAS_CACHE_TTL_MS || '5000', 10),
  blockchain: {
    rpcUrl: process.env.RPC_URL || 'YOUR_ETHEREUM_NODE_RPC_URL',
  },
});
