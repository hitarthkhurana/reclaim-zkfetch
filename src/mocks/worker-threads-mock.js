// Mock implementation of worker_threads
module.exports = {
  workerData: {
    module: 'mock-module',
    // Add any other properties that the code expects
  },
  parentPort: {
    postMessage: () => {},
    on: () => {}
  },
  Worker: class {
    constructor() {
      // Mock constructor
    }
    on() {
      // Mock event handler
    }
    postMessage() {
      // Mock message sending
    }
  }
}; 