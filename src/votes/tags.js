'use strict';

var async = require('async'),
	winston = require('winston'),
	db = require('../database'),
	meta = require('../meta'),
	_ = require('underscore'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils');

module.exports = function(Votes) {
	Votes.createTags = function(tags, vid, timestamp, callback) {
		callback = callback || function () {};

		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		plugins.fireHook('filter:tags.filter', {tags: tags, vid: vid}, function(err, data) {
			if (err) {
				return callback(err);
			}

			tags = data.tags.slice(0, meta.config.tagsPerVote || 5);

			async.each(tags, function(tag, next) {
				tag = Votes.cleanUpTag(tag);

				if (tag.length < (meta.config.minimumTagLength || 3)) {
					return next();
				}
				db.setAdd('vote:' + vid + ':tags', tag);

				db.sortedSetAdd('tag:' + tag + ':votes', timestamp, vid, function(err) {
					if (!err) {
						updateTagCount(tag);
					}
					next(err);
				});
			}, callback);
		});
	};

	Votes.cleanUpTag = function(tag) {
		if (typeof tag !== 'string' || !tag.length ) {
			return '';
		}
		tag = tag.trim().toLowerCase();
		tag = tag.replace(/[,\/#!$%\^\*;:{}=_`<>'"~()?\|]/g, '');
		tag = tag.substr(0, meta.config.maximumTagLength || 15).trim();
		var matches = tag.match(/^[.-]*(.+?)[.-]*$/);
		if (matches && matches.length > 1) {
			tag = matches[1];
		}
		return tag;
	};

	Votes.updateTag = function(tag, data, callback) {
		db.setObject('tag:' + tag, data, callback);
	};

	function updateTagCount(tag, callback) {
		callback = callback || function() {};
		Votes.getTagVoteCount(tag, function(err, count) {
			if (err || !count) {
				return callback(err);
			}

			db.sortedSetAdd('tags:vote:count', count, tag, callback);
		});
	}

	Votes.getTagTids = function(tag, start, end, callback) {
		db.getSortedSetRevRange('tag:' + tag + ':votes', start, end, callback);
	};

	Votes.getTagVoteCount = function(tag, callback) {
		db.sortedSetCard('tag:' + tag + ':votes', callback);
	};

	Votes.deleteTags = function(tags, callback) {
		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		async.series([
			function(next) {
				removeTagsFromVotes(tags, next);
			},
			function(next) {
				var keys = tags.map(function(tag) {
					return 'tag:' + tag + ':votes';
				});
				db.deleteAll(keys, next);
			},
			function(next) {
				db.sortedSetRemove('tags:vote:count', tags, next);
			}
		], callback);
	};

	function removeTagsFromVotes(tags, callback) {
		async.eachLimit(tags, 50, function(tag, next) {
			db.getSortedSetRange('tag:' + tag + ':votes', 0, -1, function(err, vids) {
				if (err || !vids.length) {
					return next(err);
				}
				var keys = vids.map(function(vid) {
					return 'vote:' + vid + ':tags';
				});

				db.setsRemove(keys, tag, next);
			});
		}, callback);
	}

	Votes.deleteTag = function(tag) {
		db.delete('tag:' + tag + ':votes');
		db.sortedSetRemove('tags:vote:count', tag);
	};

	Votes.getTags = function(start, end, callback) {
		db.getSortedSetRevRangeWithScores('tags:vote:count', start, end, function(err, tags) {
			if (err) {
				return callback(err);
			}

			Votes.getTagData(tags, callback);
		});
	};

	Votes.getTagData = function(tags, callback) {
		var keys = tags.map(function(tag) {
			return 'tag:' + tag.value;
		});

		db.getObjects(keys, function(err, tagData) {
			if (err) {
				return callback(err);
			}

			tags.forEach(function(tag, index) {
				tag.color = tagData[index] ? tagData[index].color : '';
				tag.bgColor = tagData[index] ? tagData[index].bgColor : '';
			});
			callback(null, tags);
		});
	};

	Votes.getVoteTags = function(vid, callback) {
		db.getSetMembers('vote:' + vid + ':tags', callback);
	};

	Votes.getVoteTagsObjects = function(vid, callback) {
		Votes.getVotesTagsObjects([vid], function(err, data) {
			callback(err, Array.isArray(data) && data.length ? data[0] : []);
		});
	};

	Votes.getVotesTagsObjects = function(vids, callback) {
		var sets = vids.map(function(vid) {
			return 'vote:' + vid + ':tags';
		});

		db.getSetsMembers(sets, function(err, voteTags) {
			if (err) {
				return callback(err);
			}

			var uniqueVoteTags = _.uniq(_.flatten(voteTags));

			var tags = uniqueVoteTags.map(function(tag) {
				return {value: tag};
			});

			async.parallel({
				tagData: function(next) {
					Votes.getTagData(tags, next);
				},
				counts: function(next) {
					db.sortedSetScores('tags:vote:count', uniqueVoteTags, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.tagData.forEach(function(tag, index) {
					tag.score = results.counts[index] ? results.counts[index] : 0;
				});

				var tagData = _.object(uniqueVoteTags, results.tagData);

				voteTags.forEach(function(tags, index) {
					if (Array.isArray(tags)) {
						voteTags[index] = tags.map(function(tag) {return tagData[tag];});
					}
				});

				callback(null, voteTags);
			});
		});
	};

	Votes.updateTags = function(vid, tags, callback) {
		callback = callback || function() {};
		Votes.getVoteField(vid, 'timestamp', function(err, timestamp) {
			if (err) {
				return callback(err);
			}

			Votes.deleteVoteTags(vid, function(err) {
				if (err) {
					return callback(err);
				}

				Votes.createTags(tags, vid, timestamp, callback);
			});
		});
	};

	Votes.deleteVoteTags = function(vid, callback) {
		Votes.getVoteTags(vid, function(err, tags) {
			if (err) {
				return callback(err);
			}

			async.series([
				function(next) {
					db.delete('vote:' + vid + ':tags', next);
				},
				function(next) {
					var sets = tags.map(function(tag) {
						return 'tag:' + tag + ':votes';
					});

					db.sortedSetsRemove(sets, vid, next);
				},
				function(next) {
					async.each(tags, function(tag, next) {
						updateTagCount(tag, next);
					}, next);
				}
			], callback);
		});
	};

	Votes.searchTags = function(data, callback) {
		if (!data) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('tags:vote:count', 0, -1, function(err, tags) {
			if (err) {
				return callback(null, []);
			}
			if (data.query === '') {
				return callback(null, tags);
			}
			data.query = data.query.toLowerCase();

			var matches = [];
			for(var i=0; i<tags.length; ++i) {
				if (tags[i].toLowerCase().startsWith(data.query)) {
					matches.push(tags[i]);
				}
			}

			matches = matches.slice(0, 20).sort(function(a, b) {
				return a > b;
			});

			plugins.fireHook('filter:tags.search', {data: data, matches: matches}, function(err, data) {
				callback(err, data ? data.matches : []);
			});
		});
	};

	Votes.searchAndLoadTags = function(data, callback) {
		if (!data.query || !data.query.length) {
			return callback(null, []);
		}
		Votes.searchTags(data, function(err, tags) {
			if (err) {
				return callback(err);
			}
			async.parallel({
				counts: function(next) {
					db.sortedSetScores('tags:vote:count', tags, next);
				},
				tagData: function(next) {
					tags = tags.map(function(tag) {
						return {value: tag};
					});

					Votes.getTagData(tags, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				results.tagData.forEach(function(tag, index) {
					tag.score = results.counts[index];
				});
				results.tagData.sort(function(a, b) {
					return b.score - a.score;
				});

				callback(null, results.tagData);
			});
		});
	};
};
