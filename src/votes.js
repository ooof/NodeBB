"use strict";

var async = require('async'),
	validator = require('validator'),

	_ = require('underscore'),
	db = require('./database'),
	posts = require('./posts'),
	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	user = require('./user'),
	categories = require('./categories'),
	privileges = require('./privileges');

(function(Votes) {

	require('./votes/create')(Votes);
	require('./votes/votes')(Votes);
	require('./votes/delete')(Votes);
	require('./votes/unread')(Votes);
	require('./votes/recent')(Votes);
	require('./votes/popular')(Votes);
	require('./votes/user')(Votes);
	require('./votes/fork')(Votes);
	require('./votes/posts')(Votes);
	require('./votes/follow')(Votes);
	require('./votes/tags')(Votes);
	require('./votes/teaser')(Votes);
	require('./votes/suggested')(Votes);

	Votes.exists = function(vid, callback) {
		db.isSortedSetMember('votes:vid', vid, callback);
	};

	Votes.getVoteData = function(vid, callback) {
		db.getObject('vote:' + vid, function(err, vote) {
			if (err || !vote) {
				return callback(err);
			}
			modifyVote(vote, callback);
		});
	};

	Votes.getVotesData = function(tids, callback) {
		var keys = [];

		for (var i=0; i<tids.length; ++i) {
			keys.push('vote:' + tids[i]);
		}

		db.getObjects(keys, function(err, votes) {
			if (err) {
				return callback(err);
			}
			async.map(votes, modifyVote, callback);
		});
	};

	function modifyVote(vote, callback) {
		if (!vote) {
			return callback(null, vote);
		}
		vote.title = validator.escape(vote.title);
		vote.relativeTime = utils.toISOString(vote.timestamp);
		callback(null, vote);
	}

	Votes.getPageCount = function(tid, uid, callback) {
		Votes.getVoteField(tid, 'postcount', function(err, postCount) {
			if (err) {
				return callback(err);
			}
			if (!parseInt(postCount, 10)) {
				return callback(null, 1);
			}
			user.getSettings(uid, function(err, settings) {
				if (err) {
					return callback(err);
				}

				callback(null, Math.ceil((parseInt(postCount, 10) - 1) / settings.postsPerPage));
			});
		});
	};

	Votes.getTidPage = function(tid, uid, callback) {
		if(!tid) {
			return callback(new Error('[[error:invalid-tid]]'));
		}

		async.parallel({
			index: function(next) {
				categories.getVoteIndex(tid, next);
			},
			settings: function(next) {
				user.getSettings(uid, next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}
			callback(null, Math.ceil((results.index + 1) / results.settings.votesPerPage));
		});
	};

	Votes.getCategoryData = function(tid, callback) {
		Votes.getVoteField(tid, 'cid', function(err, cid) {
			if (err) {
				callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
	};

	Votes.getVotesFromSet = function(set, uid, start, end, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange(set, start, end, next);
			},
			function(tids, next) {
				Votes.getVotes(tids, uid, next);
			},
			function(votes, next) {
				next(null, {votes: votes, nextStart: end + 1});
			}
		], callback);
	};

	Votes.getVotes = function(tids, uid, callback) {
		async.waterfall([
			function(next) {
				privileges.votes.filter('read', tids, uid, next);
			},
			function(tids, next) {
				Votes.getVotesByVids(tids, uid, next);
			}
		], callback);
	};

	Votes.getVotesByVids = function(tids, uid, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		Votes.getVotesData(tids, function(err, votes) {
			function mapFilter(array, field) {
				return array.map(function(vote) {
					return vote && vote[field] && vote[field].toString();
				}).filter(function(value, index, array) {
					return utils.isNumber(value) && array.indexOf(value) === index;
				});
			}

			if (err) {
				return callback(err);
			}

			var uids = mapFilter(votes, 'uid');
			var cids = mapFilter(votes, 'cid');

			async.parallel({
				teasers: function(next) {
					Votes.getTeasers(votes, next);
				},
				users: function(next) {
					user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
				},
				categories: function(next) {
					categories.getMultipleCategoryFields(cids, ['cid', 'name', 'slug', 'icon', 'bgColor', 'color', 'disabled'], next);
				},
				hasRead: function(next) {
					Votes.hasReadVotes(tids, uid, next);
				},
				tags: function(next) {
					Votes.getVotesTagsObjects(tids, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var users = _.object(uids, results.users);
				var categories = _.object(cids, results.categories);

				for (var i=0; i<votes.length; ++i) {
					if (votes[i]) {
						votes[i].category = categories[votes[i].cid];
						votes[i].user = users[votes[i].uid];
						votes[i].teaser = results.teasers[i];
						votes[i].tags = results.tags[i];

						votes[i].isOwner = parseInt(votes[i].uid, 10) === parseInt(uid, 10);
						votes[i].pinned = parseInt(votes[i].pinned, 10) === 1;
						votes[i].locked = parseInt(votes[i].locked, 10) === 1;
						votes[i].deleted = parseInt(votes[i].deleted, 10) === 1;
						votes[i].unread = !results.hasRead[i];
						votes[i].unreplied = parseInt(votes[i].postcount, 10) <= 1;
					}
				}

				votes = votes.filter(function(vote) {
					return vote &&	vote.category && !vote.category.disabled;
				});

				plugins.fireHook('filter:votes.get', {votes: votes, uid: uid}, function(err, voteData) {
					callback(err, voteData.votes);
				});
			});
		});
	};

	Votes.getVoteWithPosts = function(tid, set, uid, start, end, reverse, callback) {
		Votes.getVoteData(tid, function(err, voteData) {
			if (err || !voteData) {
				return callback(err || new Error('[[error:no-vote]]'));
			}

			async.parallel({
				posts: async.apply(getMainPostAndReplies, voteData, set, uid, start, end, reverse),
				category: async.apply(Votes.getCategoryData, tid),
				threadTools: async.apply(plugins.fireHook, 'filter:vote.thread_tools', {vote: voteData, uid: uid, tools: []}),
				tags: async.apply(Votes.getVoteTagsObjects, tid),
				isFollowing: async.apply(Votes.isFollowing, [tid], uid)
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				voteData.posts = results.posts;
				voteData.category = results.category;
				voteData.thread_tools = results.threadTools.tools;
				voteData.tags = results.tags;
				voteData.isFollowing = results.isFollowing[0];

				voteData.unreplied = parseInt(voteData.postcount, 10) === 1;
				voteData.deleted = parseInt(voteData.deleted, 10) === 1;
				voteData.locked = parseInt(voteData.locked, 10) === 1;
				voteData.pinned = parseInt(voteData.pinned, 10) === 1;

				plugins.fireHook('filter:vote.get', {vote: voteData, uid: uid}, function(err, data) {
					callback(err, data ? data.vote : null);
				});
			});
		});
	};

	function getMainPostAndReplies(vote, set, uid, start, end, reverse, callback) {
		async.waterfall([
			function(next) {
				posts.getPidsFromSet(set, start, end, reverse, next);
			},
			function(pids, next) {
				if ((!Array.isArray(pids) || !pids.length) && !vote.mainPid) {
					return callback(null, []);
				}

				if (vote.mainPid) {
					pids.unshift(vote.mainPid);
				}
				posts.getPostsByPids(pids, uid, next);
			},
			function(posts, next) {
				if (!posts.length) {
					return next(null, []);
				}

				if (vote.mainPid) {
					posts[0].index = 0;
				}

				var indices = Votes.calculatePostIndices(start, end, vote.postcount, reverse);
				for (var i=1; i<posts.length; ++i) {
					if (posts[i]) {
						posts[i].index = indices[i - 1];
					}
				}

				Votes.addPostData(posts, uid, callback);
			}
		]);
	}

	Votes.getMainPost = function(tid, uid, callback) {
		Votes.getMainPosts([tid], uid, function(err, mainPosts) {
			callback(err, Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null);
		});
	};

	Votes.getMainPids = function(tids, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		Votes.getVotesFields(tids, ['mainPid'], function(err, voteData) {
			if (err) {
				return callback(err);
			}

			var mainPids = voteData.map(function(vote) {
				return vote && vote.mainPid;
			});
			callback(null, mainPids);
		});
	};

	Votes.getMainPosts = function(tids, uid, callback) {
		Votes.getMainPids(tids, function(err, mainPids) {
			if (err) {
				return callback(err);
			}
			getMainPosts(mainPids, uid, callback);
		});
	};

	function getMainPosts(mainPids, uid, callback) {
		posts.getPostsByPids(mainPids, uid, function(err, postData) {
			if (err) {
				return callback(err);
			}
			postData.forEach(function(post) {
				if (post) {
					post.index = 0;
				}
			});
			Votes.addPostData(postData, uid, callback);
		});
	}

	Votes.getVoteField = function(vid, field, callback) {
		db.getObjectField('vote:' + vid, field, callback);
	};

	Votes.getVoteFields = function(vid, fields, callback) {
		db.getObjectFields('vote:' + vid, fields, callback);
	};

	Votes.getVotesFields = function(vids, fields, callback) {
		if (!Array.isArray(vids) || !vids.length) {
			return callback(null, []);
		}
		var keys = vids.map(function(vid) {
			return 'vote:' + vid;
		});
		db.getObjectsFields(keys, fields, callback);
	};

	Votes.setVoteField = function(vid, field, value, callback) {
		db.setObjectField('vote:' + vid, field, value, callback);
	};

	Votes.isLocked = function(tid, callback) {
		Votes.getVoteField(tid, 'locked', function(err, locked) {
			callback(err, parseInt(locked, 10) === 1);
		});
	};

	Votes.search = function(tid, term, callback) {
		if (plugins.hasListeners('filter:vote.search')) {
			plugins.fireHook('filter:vote.search', {
				tid: tid,
				term: term
			}, callback);
		} else {
			callback(new Error('no-plugins-available'), []);
		}
	};

}(exports));
