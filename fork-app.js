const {
    Worker
} = require('node:worker_threads');

const transfers = new Worker('./transfers.js');

// Create the second Web Worker
const follower = new Worker('./follower.js');

// Handle messages from the workers (if needed)
// transfers.onmessage = function (event) {
//   console.log('Worker 1 says:', event.data);
// };

// follower.onmessage = function (event) {
//   console.log('Worker 2 says:', event.data);
// };