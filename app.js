var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);
var path = require('path');
var r = require('rethinkdb');
var io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/data', function (request, reply) {
    r.connect({host: 'localhost', port: 28015}, function (err, conn) {
        if (err) throw err;

        var now = new Date();
        var then = new Date();
        then.setHours(then.getHours() - 5);

        r.db('co2monitor')
            .table('history')
            .between(then, now, {index: 'timestamp'})
            .orderBy({index: 'timestamp'})
            .pluck('timestamp', 'co2', 'tmp')
            .run(conn, function (err, cursor) {
                var result = [];
                var key = [];
                var bucket = [];

                cursor.each(function (err, row) {
                    if (err) throw err;

                    var thisKey = [
                        row.timestamp.getFullYear(),
                        row.timestamp.getMonth(),
                        row.timestamp.getDate(),
                        row.timestamp.getHours(),
                        row.timestamp.getMinutes()
                    ];

                    if (thisKey[0] !== key[0] ||
                        thisKey[1] !== key[1] ||
                        thisKey[2] !== key[2] ||
                        thisKey[3] !== key[3] ||
                        thisKey[4] !== key[4]) {
                        // We have a new key!
                        var co2sum = 0;
                        var tmpsum = 0;
                        if (bucket.length > 0) {
                            for (var i = 0; i < bucket.length; ++i) {
                                co2sum += bucket[i].co2;
                                tmpsum += bucket[i].tmp;
                            }

                            result.push({
                                timestamp: new Date(
                                    key[0],
                                    key[1],
                                    key[2],
                                    key[3],
                                    key[4]
                                ),
                                co2: co2sum / bucket.length,
                                tmp: tmpsum / bucket.length
                            });
                        }

                        key = thisKey;
                        bucket = [];
                    }

                    bucket.push({
                        co2: row.co2,
                        tmp: row.tmp
                    });
                }, function () {
                    reply.send(JSON.stringify(result));
                });
//                cursor.toArray(function (err, result) {
//                    reply.send(JSON.stringify(result));
//                });
            });
    });
});

io.on('connection', function (socket) {
    console.log('a user connected');
});

module.exports = {
    app: app,
    server: server
};

