'use strict';

var async = require('async'),
	_ = require('underscore'),

	categories = require('../categories'),
	search = require('../search'),
	db = require('../database');

module.exports = function(Votes) {
	Votes.getSuggestedVotes = function(vid, uid, start, end, callback) {
		async.parallel({
			tagTids: function(next) {
				getTidsWithSameTags(vid, next);
			},
			searchTids: function(next) {
				getSearchTids(vid, next);
			},
			categoryTids: function(next) {
				getCategoryTids(vid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var vids = results.tagTids.concat(results.searchTids).concat(results.categoryTids);
			vids = vids.filter(function(_vid, index, array) {
				return parseInt(_vid, 10) !== parseInt(vid, 10) && array.indexOf(_vid) === index;
			}).slice(start, end + 1);

			Votes.getVotes(vids, uid, callback);
		});
	};

	function getTidsWithSameTags(vid, callback) {
		async.waterfall([
			function(next) {
				Votes.getVoteTags(vid, next);
			},
			function(tags, next) {
				async.map(tags, function(tag, next) {
					Votes.getTagTids(tag, 0, -1, next);
				}, next);
			},
			function(data, next) {
				next(null, _.unique(_.flatten(data)));
			}
		], callback);
	}

	function getSearchTids(vid, callback) {
		async.waterfall([
			function(next) {
				Votes.getVoteField(vid, 'title', next);
			},
			function(title, next) {
				search.searchQuery('vote', title, next);
			}
		], callback);
	}

	function getCategoryTids(vid, callback) {
		Votes.getVoteField(vid, 'cid', function(err, cid) {
			if (err || !cid) {
				return callback(err, []);
			}
			categories.getVoteIds('cid:' + cid + ':vids', true, 0, 9, callback);
		});
	}
};
