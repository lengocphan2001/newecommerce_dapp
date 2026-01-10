// Alternative config if hardhat.config.js has issues
// This file is not used by default, but can help with path resolution

module.exports = {
  // Ensure node_modules are properly resolved
  resolve: {
    modules: ['node_modules'],
  },
};
