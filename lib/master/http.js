var net = require('net');
var http = require('http');
var server = null;
var cluster = require('cluster');
var master = require('../master');

module.exports = {
  messageHandler: function(message, handle, worker) {
    if (typeof message === 'object' && message.event && message.event === 'http:listen') {
      setupServer(message.args);
    }
  }
};

function setupServer(args) {
  if (!server) {
    var seed = ~~(Math.random() * 1e9);
    server = net.createServer(function(c) {
      // Get int31 hash of ip
      var ipHash = hash((c.remoteAddress || '').split(/\./g), seed);

      //// Pass connection to worker
      var workerNum = ipHash % master.count;
      var current = 0;
      for (var i in cluster.workers) {
        if (workerNum == current++ && cluster.workers.hasOwnProperty(i)) {
          cluster.workers[i].send('sticky-session:connection', c);
          return;
        }
      }

      // Whoops, we shouldn't of gotten here
      // Lets just pick the first worker
      for (i in cluster.workers) {
        if (cluster.workers.hasOwnProperty(i)) {
          cluster.workers[i].send('sticky-session:connection', c);
          return;
        }
      }
    });

    server.listen.apply(server, args);
  }
}

/**
 * Int31 Hash taken from [https://github.com/indutny/sticky-session]
 *
 * @param ip
 * @param seed
 * @returns hash
 */
function hash(ip, seed) {
  var hash = ip.reduce(function(r, num) {
    r += parseInt(num, 10);
    r %= 2147483648;
    r += (r << 10);
    r %= 2147483648;
    r ^= r >> 6;
    return r;
  }, seed);

  hash += hash << 3;
  hash %= 2147483648;
  hash ^= hash >> 11;
  hash += hash << 15;
  hash %= 2147483648;

  return hash >>> 0;
}