'use strict';

var async = require('async'),
	db = require('../database'),
	privileges = require('../privileges');

module.exports = function(Votes) {
	Votes.getPopular = function(term, uid, count, callback) {
		count = parseInt(count, 10) || 20;

		if (term === 'alltime') {
			return getAllTimePopular(uid, count, callback);
		}

		async.waterfall([
			function(next) {
				Votes.getLatestTidsFromSet('votes:vid', 0, -1, term, next);
			},
			function(vids, next) {
				getVotes(vids, uid, count, next);
			}
		], callback);
	};

	function getAllTimePopular(uid, count, callback) {
		Votes.getVotesFromSet('votes:posts', uid, 0, count - 1, function(err, data) {
			callback(err, data ? data.votes : null);
		});
	}

	function getVotes(vids, uid, count, callback) {
		async.waterfall([
			function(next) {
				Votes.getVotesFields(vids, ['vid', 'postcount', 'deleted'], next);
			},
			function(votes, next) {
				vids = votes.filter(function(vote) {
					return vote && parseInt(vote.deleted, 10) !== 1;
				}).sort(function(a, b) {
					return b.postcount - a.postcount;
				}).slice(0, count).map(function(vote) {
					return vote.vid;
				});
				privileges.votes.filter('read', vids, uid, next);
			},
			function(vids, next) {
				Votes.getVotesByTids(vids, uid, next);
			}
		], callback);
	}
};
