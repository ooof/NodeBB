'use strict';

var async = require('async'),
	winston = require('winston'),
	_ = require('underscore'),

	db = require('../database'),
	user = require('../user'),
	favourites = require('../favourites'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	meta = require('../meta');
	require('../privileges/posts')(privileges);

module.exports = function(Votes) {
	Votes.onNewPostMade = function(postData, callback) {
		async.parallel([
			function(next) {
				Votes.increasePostCount(postData.vid, next);
			},
			function(next) {
				Votes.updateTimestamp(postData.vid, postData.timestamp, next);
			},
			function(next) {
				Votes.addPostToVote(postData.vid, postData.pid, postData.timestamp, 0, next);
			}
		], callback);
	};

	Votes.getVotePosts = function(tid, set, start, end, uid, reverse, callback) {
		callback = callback || function() {};
		async.parallel({
			posts: function(next) {
				posts.getPostsByTid(tid, set, start, end, uid, reverse, next);
			},
			postCount: function(next) {
				Votes.getVoteField(tid, 'postcount', next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var indices = Votes.calculatePostIndices(start, end, results.postCount, reverse);
			results.posts.forEach(function(post, index) {
				if (post) {
					post.index = indices[index];
				}
			});

			Votes.addPostData(results.posts, uid, callback);
		});
	};

	Votes.addPostData = function(postData, uid, callback) {
		if (!Array.isArray(postData) || !postData.length) {
			return callback(null, []);
		}
		var pids = postData.map(function(post) {
			return post && post.pid;
		});

		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		async.parallel({
			favourites: function(next) {
				favourites.getFavouritesByPostIDs(pids, uid, next);
			},
			voteData: function(next) {
				favourites.getVoteStatusByPostIDs(pids, uid, next);
			},
			userData: function(next) {
				var uids = [];

				for(var i=0; i<postData.length; ++i) {
					if (postData[i] && uids.indexOf(postData[i].uid) === -1) {
						uids.push(postData[i].uid);
					}
				}

				posts.getUserInfoForPosts(uids, uid, function(err, users) {
					if (err) {
						return next(err);
					}

					var userData = {};
					users.forEach(function(user, index) {
						userData[uids[index]] = user;
					});

					next(null, userData);
				});
			},
			editors: function(next) {
				var editors = [];
				for(var i=0; i<postData.length; ++i) {
					if (postData[i] && postData[i].editor && editors.indexOf(postData[i].editor) === -1) {
						editors.push(postData[i].editor);
					}
				}

				user.getMultipleUserFields(editors, ['uid', 'username', 'userslug'], function(err, editors) {
					if (err) {
						return next(err);
					}
					var editorData = {};
					editors.forEach(function(editor) {
						editorData[editor.uid] = editor;
					});
					next(null, editorData);
				});
			},
			privileges: function(next) {
				privileges.posts.get(pids, uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			postData.forEach(function(postObj, i) {
				if (postObj) {
					postObj.deleted = parseInt(postObj.deleted, 10) === 1;
					postObj.user = parseInt(postObj.uid, 10) ? results.userData[postObj.uid] : _.clone(results.userData[postObj.uid]);
					postObj.editor = postObj.editor ? results.editors[postObj.editor] : null;
					postObj.favourited = results.favourites[i];
					postObj.upvoted = results.voteData.upvotes[i];
					postObj.downvoted = results.voteData.downvotes[i];
					postObj.votes = postObj.votes || 0;
					postObj.display_moderator_tools = results.privileges[i].editable;
					postObj.display_move_tools = results.privileges[i].move && postObj.index !== 0;
					postObj.selfPost = parseInt(uid, 10) === parseInt(postObj.uid, 10);

					if(postObj.deleted && !results.privileges[i].view_deleted) {
						postObj.content = '[[vote:post_is_deleted]]';
					}

					// Username override for guests, if enabled
					if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(postObj.uid, 10) === 0 && postObj.handle) {
						postObj.user.username = postObj.handle;
					}
				}
			});

			callback(null, postData);
		});
	};

	Votes.calculatePostIndices = function(start, end, postCount, reverse) {
		var indices = [];
		var count = end - start + 1;
		for(var i=0; i<count; ++i) {
			if (reverse) {
				indices.push(postCount - (start + i + 1));
			} else {
				indices.push(start + i + 1);
			}
		}
		return indices;
	};

	Votes.getLatestUndeletedPid = function(tid, callback) {
		Votes.getLatestUndeletedReply(tid, function(err, pid) {
			if (err) {
				return callback(err);
			}
			if (parseInt(pid, 10)) {
				return callback(null, pid.toString());
			}
			Votes.getVoteField(tid, 'mainPid', function(err, mainPid) {
				callback(err, parseInt(mainPid, 10) ? mainPid.toString() : null);
			});
		});
	};

	Votes.getLatestUndeletedReply = function(tid, callback) {
		var isDeleted = false;
		var done = false;
		var latestPid = null;
		var index = 0;
		async.doWhilst(
			function(next) {
				db.getSortedSetRevRange('tid:' + tid + ':posts', index, index, function(err, pids) {
					if (err) {
						return next(err);
					}

					if (!Array.isArray(pids) || !pids.length) {
						done = true;
						return next();
					}

					posts.getPostField(pids[0], 'deleted', function(err, deleted) {
						if (err) {
							return next(err);
						}
						latestPid = pids[0];
						isDeleted = parseInt(deleted, 10) === 1;
						++index;
						next();
					});
				});
			},
			function() {
				return isDeleted && !done;
			},
			function(err) {
				callback(err, latestPid);
			}
		);
	};

	Votes.addPostToVote = function(vid, pid, timestamp, votes, callback) {
		Votes.getVoteField(vid, 'mainPid', function(err, mainPid) {
			if (err) {
				return callback(err);
			}
			if (!parseInt(mainPid, 10)) {
				Votes.setVoteField(vid, 'mainPid', pid, callback);
			} else {
				async.parallel([
					function(next) {
						db.sortedSetAdd('vid:' + vid + ':posts', timestamp, pid, next);
					},
					function(next) {
						db.sortedSetAdd('vid:' + vid + ':posts:votes', votes, pid, next);
					}
				], function(err) {
					if (err) {
						return callback(err);
					}
					Votes.updateTeaser(vid, callback);
				});
			}
		});
	};

	Votes.removePostFromVote = function(tid, pid, callback) {
		db.sortedSetsRemove(['tid:' + tid + ':posts', 'tid:' + tid + ':posts:votes'], pid, function(err) {
			if (err) {
				return callback(err);
			}
			Votes.updateTeaser(tid, callback);
		});
	};

	Votes.getPids = function(tid, callback) {
		async.parallel({
			mainPid: function(next) {
				Votes.getVoteField(tid, 'mainPid', next);
			},
			pids: function(next) {
				db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			if (results.mainPid) {
				results.pids = [results.mainPid].concat(results.pids);
			}
			callback(null, results.pids);
		});
	};

	Votes.increasePostCount = function(vid, callback) {
		incrementFieldAndUpdateSortedSet(vid, 'postcount', 1, 'votes:posts', callback);
	};

	Votes.decreasePostCount = function(vid, callback) {
		incrementFieldAndUpdateSortedSet(vid, 'postcount', -1, 'votes:posts', callback);
	};

	Votes.increaseViewCount = function(vid, callback) {
		incrementFieldAndUpdateSortedSet(vid, 'viewcount', 1, 'votes:views', callback);
	};

	function incrementFieldAndUpdateSortedSet(vid, field, by, set, callback) {
		callback = callback || function() {};
		db.incrObjectFieldBy('vote:' + vid, field, by, function(err, value) {
			if (err) {
				return callback(err);
			}
			db.sortedSetAdd(set, value, vid, callback);
		});
	}

	Votes.getTitleByPid = function(pid, callback) {
		Votes.getVoteFieldByPid('title', pid, callback);
	};

	Votes.getVoteFieldByPid = function(field, pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			if (err) {
				return callback(err);
			}
			Votes.getVoteField(tid, field, callback);
		});
	};

	Votes.getVoteDataByPid = function(pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			if (err) {
				return callback(err);
			}
			Votes.getVoteData(tid, callback);
		});
	};

	Votes.getPostCount = function(tid, callback) {
		db.getObjectField('vote:' + tid, 'postcount', callback);
	};
};
