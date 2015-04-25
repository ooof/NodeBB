"use strict";

module.exports = function(redisClient, module) {

	var helpers = module.helpers.redis;

	module.listPrepend = function(key, value, callback) {
		callback = callback || function() {};
		redisClient.lpush(key, value, function(err, res) {
			callback(err);
		});
	};

	module.listAppend = function(key, value, callback) {
		callback = callback || function() {};
		redisClient.rpush(key, value, function(err, res) {
			callback(err);
		});
	};

	module.listRemoveLast = function(key, callback) {
		callback = callback || function() {};
		redisClient.rpop(key, callback);
	};

	module.listRemoveAll = function(key, value, callback) {
		callback = callback || function() {};
		redisClient.lrem(key, 0, value, function(err, res) {
			callback(err);
		});
	};

	module.listTrim = function(key, start, stop, callback) {
		callback = callback || function() {};
		redisClient.ltrim(key, start, stop, function(err, res) {
			callback(err);
		});
	};

	module.getListRange = function(key, start, stop, callback) {
		callback = callback || function() {};
		redisClient.lrange(key, start, stop, callback);
	};

	module.listAppendMulti = function(key, value, callback) {
		callback = callback || function() {};
		if (!Array.isArray(value)) {
			value = [value];
		}

		helpers.multiKeyValues(redisClient, 'rpush', key, value, callback);
	};
};