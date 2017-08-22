var standardTests = require('passwordless-tokenstore-test');
var util = require('util');
var bcrypt = require('bcrypt');
var ProtoStore = require('passwordless-tokenstore');

var sqlite = require("sqlite3").verbose();

var SQLiteStore = require("../");
var conString = "passwordless";

function TokenStoreFactory() {
    return new SQLiteStore(conString);
}

var beforeEachTest = function(done) {
    var con = new sqlite.Database('passwordless');
    con.run("delete from passwordless", function(err) {
        if (err) {
            console.log("err:", err);
        }
        done();
    });
}

var afterEachTest = function(done) {
    // any other activity after each test
    done();
}

// Call the test suite
standardTests(TokenStoreFactory, beforeEachTest, afterEachTest);