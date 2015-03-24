'use strict';

var async = require('async'),
	winston = require('winston'),
	db = require('../database');

module.exports = function(Votes) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		year: 31104000000
	};

	Votes.getLatestVotes = function(uid, start, end, term, callback) {
		async.waterfall([
			function (next) {
				Votes.getLatestTidsFromSet('votes:recent', start, end, term, next);
			},
			function(tids, next) {
				Votes.getVotes(tids, uid, next);
			},
			function(votes, next) {
				next(null, {votes: votes, nextStart: end + 1});
			}
		], callback);
	};

	Votes.getLatestTids = function(start, end, term, callback) {
		winston.warn('[deprecation warning] please use Votes.getLatestTidsFromSet("votes:recent")');
		Votes.getLatestTidsFromSet('votes:recent', start, end, term, callback);
	};

	Votes.getLatestTidsFromSet = function(set, start, end, term, callback) {
		var since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		var count = parseInt(end, 10) === -1 ? end : end - start + 1;

		db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since, callback);
	};

	Votes.updateTimestamp = function(vid, timestamp, callback) {
		async.parallel([
			function(next) {
				Votes.updateRecent(vid, timestamp, next);
			},
			function(next) {
				Votes.setVoteField(vid, 'lastposttime', timestamp, next);
			}
		], callback);
	};

	Votes.updateRecent = function(tid, timestamp, callback) {
		callback = callback || function() {};
		db.sortedSetAdd('votes:recent', timestamp, tid, callback);
	};
};
