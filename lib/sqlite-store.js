var util = require('util');
var bcrypt = require('bcrypt');
var ProtoStore = require('passwordless-tokenstore');
var sqlite3 = require('sqlite3').verbose();


/**
 * Constructor of Store
 * @param {String} conString Name of SQLite file to use.  
 * @constructor
 */
function Store(conString) {
    var self = this;
    self._table = "passwordless";
    self._client = new sqlite3.Database(conString);
    self._client.run("CREATE TABLE IF NOT EXISTS " + self._table + " " +
        "(uid character varying(160), token character varying(60) NOT NULL, origin text, ttl bigint, " +
        "CONSTRAINT passwordless_pkey PRIMARY KEY (uid), CONSTRAINT passwordless_token_key UNIQUE (token), CONSTRAINT passwordless_uid_key UNIQUE (uid) )");
}

util.inherits(Store, ProtoStore);

/**
 * Checks if the provided token / user id combination exists and is
 * valid in terms of time-to-live. If yes, the method provides the 
 * the stored referrer URL if any. 
 * @param  {String}   token to be authenticated
 * @param  {String}   uid Unique identifier of an user
 * @param  {Function} callback in the format (error, valid, referrer).
 * In case of error, error will provide details, valid will be false and
 * referrer will be null. If the token / uid combination was not found 
 * found, valid will be false and all else null. Otherwise, valid will 
 * be true, referrer will (if provided when the token was stored) the 
 * original URL requested and error will be null.
 */
Store.prototype.authenticate = function(token, uid, callback) {
    if (!token || !uid || !callback) {
        throw new Error('TokenStore:authenticate called with invalid parameters');
    }

    var self = this;
    self._client.serialize(function() {
        self._client.all('SELECT * FROM ' + self._table + ' WHERE uid=$uid', { $uid: uid }, function(err, result) {
            if (err) {
                return callback(err, false, null);
            }
            if (!result || !result || !result.length || (result && result.length > 1)) {
                return callback(null, false, null);
            } else if (Date.now() > result[0].ttl) {
                callback(null, false, null);
            } else {
                bcrypt.compare(token, result[0].token, function(err, res) {
                    if (err) {
                        return callback(err, false, null);
                    }

                    if (res) {
                        callback(null, true, result[0].origin == null ? "" : result[0].origin);
                    } else {
                        callback(null, false, null);
                    }
                });
            }
        });
    })
};

/**
 * Stores a new token / user ID combination or updates the token of an
 * existing user ID if that ID already exists. Hence, a user can only
 * have one valid token at a time
 * @param  {String}   token Token that allows authentication of _uid_
 * @param  {String}   uid Unique identifier of an user
 * @param  {Number}   msToLive Validity of the token in ms
 * @param  {String}   originUrl Originally requested URL or null
 * @param  {Function} callback Called with callback(error) in case of an
 * error or as callback() if the token was successully stored / updated
 */
Store.prototype.storeOrUpdate = function(token, uid, msToLive, originUrl, callback) {
    if (!token || !uid || !msToLive || !callback || isNaN(msToLive)) {
        throw new Error('TokenStore:storeOrUpdate called with invalid parameters');
    }

    var self = this;
    bcrypt.hash(token, 10, function(err, hashedToken) {
        if (err) {
            return callback(err);
        }
        self._client.serialize(function() {

            var paramobj = {
                $uid: uid,
                $token: hashedToken,
                $origin: originUrl,
                $ttl: (Date.now() + msToLive)
            }

            self._client.run('INSERT INTO ' + self._table + '(uid, token, origin, ttl) VALUES($uid, $token, $origin, $ttl)', paramobj, function(err) {
                if (err) {
                    self._client.run('UPDATE ' + self._table + ' SET token=$token, origin=$origin, ttl=$ttl WHERE uid=$uid', paramobj, function(err) {
                        if (err) {
                            callback(err);
                        } else {
                            callback();
                        }
                    });
                } else {
                    callback();
                }
            });

        })
    });
};

/**
 * Invalidates and removes a user and the linked token
 * @param  {String} uid  user ID
 * @param  {Function} callback called with callback(error) in case of an
 * error or as callback() if the uid was successully invalidated
 */
Store.prototype.invalidateUser = function(uid, callback) {
    if (!uid || !callback) {
        throw new Error('TokenStore:invalidateUser called with invalid parameters');
    }

    var self = this;
    self._client.serialize(function() {

        self._client.run('DELETE FROM ' + self._table + ' WHERE uid=?', [uid], function(err) {
            if (err) {
                return callback(err);
            }

            callback();
        });
    })
};

/**
 * Removes and invalidates all token
 * @param  {Function} callback Called with callback(error) in case of an
 * error or as callback() otherwise
 */
Store.prototype.clear = function(callback) {
    if (!callback) {
        throw new Error('TokenStore:clear called with invalid parameters');
    }

    var self = this;
    self._client.serialize(function() {
        self._client.run('DELETE FROM ' + self._table, function(err) {
            if (err) {
                return callback(err);
            }
            callback();
        })
    });
};

/**
 * Number of tokens stored (no matter the validity)
 * @param  {Function} callback Called with callback(null, count) in case
 * of success or with callback(error) in case of an error
 */
Store.prototype.length = function(callback) {
    if (!callback) {
        throw new Error('TokenStore:length called with invalid parameters');
    }
    var self = this;

    self._client.serialize(function() {
        self._client.all('SELECT COUNT(uid) FROM ' + self._table, function(err, result) {
            if (err) {
                return callback(err);
            }

            callback(null, parseInt(result[0]['COUNT(uid)']));
        });
    })
};

Store.prototype.disconnect = function(callback) {
    this._client.close(callback);
};


module.exports = Store;