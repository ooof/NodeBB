
'use strict';

var async = require('async'),
	validator = require('validator'),
	db = require('../database'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins'),
	user = require('../user'),
	meta = require('../meta'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	categories = require('../categories');

module.exports = function(Topics) {

	Topics.create = function(data, callback) {
		// This is an interal method, consider using Topics.post instead
		var uid = data.uid,
			title = data.title,
			cid = data.cid,
			gid = data.gid || null,
			tags = data.tags;

		db.incrObjectField('global', 'nextTid', function(err, tid) {
			if (err) {
				return callback(err);
			}

			var slug = utils.slugify(title),
				timestamp = data.timestamp || Date.now();

			if (!slug.length) {
				return callback(new Error('[[error:invalid-title]]'));
			}

			slug = tid + '/' + slug;

			var topicData = {
				'tid': tid,
				'uid': uid,
				'mainPid': 0,
				'title': title,
				'slug': slug,
				'timestamp': timestamp,
				'lastposttime': 0,
				'postcount': 0,
				'viewcount': 0,
				'locked': 0,
				'deleted': 0,
				'pinned': 0
			};

			if (data.files) {
				topicData.record = data.files.join(',');
			}

			if (data.attachment) {
				topicData.attachment = JSON.stringify(data.attachment);
			}

			if (data.thumb) {
				topicData.thumb = data.thumb;
			}

			if (gid) {
				topicData.gid = gid;
				db.setObject('topic:' + tid, topicData, function (err) {
					if (err) {
						return callback(err);
					}

					async.parallel([
						function (next) {
							db.sortedSetsAdd([
								'topics:tid',
								'gid:' + gid + ':tids',
								'gid:' + gid + ':uid:' + uid + ':tids'
							], timestamp, tid, next);
						},
						function (next) {
							user.addTopicIdToUser(uid, tid, timestamp, next);
						},
						function (next) {
							db.incrObjectField('group:' + gid, 'topic_count', next);
						}
					], function (err) {
						if (err) {
							return callback(err);
						}
						callback(null, tid);
					});
				});
			} else {
				topicData.cid = cid;
				db.setObject('topic:' + tid, topicData, function (err) {
					if (err) {
						return callback(err);
					}

					async.parallel([
						function (next) {
							db.sortedSetsAdd([
								'topics:tid',
								'cid:' + cid + ':tids',
								'cid:' + cid + ':uid:' + uid + ':tids'
							], timestamp, tid, next);
						},
						function (next) {
							user.addTopicIdToUser(uid, tid, timestamp, next);
						},
						function (next) {
							db.incrObjectField('category:' + cid, 'topic_count', next);
						},
						function (next) {
							db.incrObjectField('global', 'topicCount', next);
						},
						function (next) {
							Topics.createTags(tags, tid, timestamp, next);
						}
					], function (err) {
						if (err) {
							return callback(err);
						}
						plugins.fireHook('action:topic.save', topicData);
						callback(null, tid);
					});
				});
			}
		});
	};

	Topics.post = function(data, callback) {
		var uid = data.uid,
			title = data.title,
			content = data.content,
			gid = data.gid || null,
			cid = data.cid,
			files = data.files,
			attachment = data.attachment,
			tags = data.tags;

		if (title) {
			title = title.trim();
		}

		if (!title || title.length < parseInt(meta.config.minimumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
		} else if (title.length > parseInt(meta.config.maximumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]'));
		}

		async.waterfall([
			function(next) {
				if (gid && files && files.length) {
					next();
				} else {
					checkContentLength(content, next);
				}
			},
			function(next) {
				if (gid) {
					return next(null, true);
				}
				categories.exists(cid, next);
			},
			function(categoryExists, next) {
				if (gid) {
					return next(null, true);
				}
				if (!categoryExists) {
					return next(new Error('[[error:no-category]]'));
				}
				privileges.categories.can('topics:create', cid, uid, next);
			},
			function(canCreate, next) {
				if(!canCreate) {
					return next(new Error('[[error:no-privileges]]'));
				}

				if (!guestHandleValid(data)) {
					return next(new Error('[[error:guest-handle-invalid]]'));
				}

				user.isReadyToPost(uid, next);
			},
			function(next) {
				if (gid) {
					return next(null, data);
				}
				plugins.fireHook('filter:topic.post', data, next);
			},
			function(filteredData, next) {
				content = filteredData.content || data.content;
				Topics.create({ uid: uid, title: title, cid: cid, gid: gid, attachment: attachment, files: files, thumb: data.thumb, tags: tags, timestamp: data.timestamp }, next);
			},
			function(tid, next) {
				Topics.reply({ uid:uid, tid:tid, gid: gid, files: files, attachment: attachment, handle: data.handle, content:content, timestamp: data.timestamp, req: data.req }, next);
			},
			function(postData, next) {
				async.parallel({
					postData: function(next) {
						next(null, postData);
					},
					settings: function(next) {
						user.getSettings(uid, function(err, settings) {
							if (err) {
								return next(err);
							}
							if (settings.followTopicsOnCreate) {
								Topics.follow(postData.tid, uid, next);
							} else {
								next();
							}
						});
					},
					topicData: function(next) {
						Topics.getTopicsByTids([postData.tid], uid, next);
					}
				}, next);
			},
			function(data, next) {
				if(!Array.isArray(data.topicData) || !data.topicData.length) {
					return next(new Error('[[error:no-topic]]'));
				}

				data.topicData = data.topicData[0];
				data.topicData.unreplied = 1;
				data.topicData.mainPost = data.postData;

				plugins.fireHook('action:topic.post', data.topicData);

				if (parseInt(uid, 10)) {
					user.notifications.sendTopicNotificationToFollowers(uid, data.topicData, data.postData);
				}

				next(null, {
					topicData: data.topicData,
					postData: data.postData
				});
			}
		], callback);
	};

	Topics.reply = function(data, callback) {
		var tid = data.tid,
			uid = data.uid,
			content = data.content,
			postData;

		async.waterfall([
			function(next) {
				Topics.getTopicField(tid, 'gid', next);
			},
			function(gid, next) {
				async.parallel({
					exists: async.apply(Topics.exists, tid),
					locked: async.apply(Topics.isLocked, tid),
					canReply: async.apply(privileges.topics.can, 'topics:reply', tid, uid),
					isGroupMember: async.apply(user.isGroupMember, uid, gid),
					isAdmin: async.apply(user.isAdministrator, uid)
				}, next);
			},
			function(results, next) {
				if (!results.exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				if (results.locked && !results.isAdmin) {
					return next(new Error('[[error:topic-locked]]'));
				}
				if (!results.canReply && !results.isGroupMember) {
					return next(new Error('[[error:no-privileges]]'));
				}

				if (!guestHandleValid(data)) {
					return next(new Error('[[error:guest-handle-invalid]]'));
				}

				user.isReadyToPost(uid, next);
			},
			function(next) {
				plugins.fireHook('filter:topic.reply', data, next);
			},
			function(filteredData, next) {
				content = filteredData.content || data.content;
				if (content) {
					content = content.trim();
				}

				if (data.files && data.files.length) {
					next();
				} else {
					checkContentLength(content, next);
				}
			},
			function(next) {
				posts.create({uid: uid, tid: tid, record: data.files, attachment: data.attachment, handle: data.handle, content: content, toPid: data.toPid, timestamp: data.timestamp, ip: data.req ? data.req.ip : null}, next);
			},
			function(data, next) {
				postData = data;
				Topics.markAsUnreadForAll(tid, next);
			},
			function(next) {
				Topics.markAsRead([tid], uid, next);
			},
			function(next) {
				async.parallel({
					userInfo: function(next) {
						posts.getUserInfoForPosts([postData.uid], uid, next);
					},
					topicInfo: function(next) {
						Topics.getTopicFields(tid, ['tid', 'title', 'slug', 'cid', 'gid', 'postcount'], next);
					},
					settings: function(next) {
						user.getSettings(uid, next);
					},
					postIndex: function(next) {
						posts.getPidIndex(postData.pid, uid, next);
					},
					content: function(next) {
						posts.parsePost(postData, next);
					}
				}, next);
			},
			function(results, next) {
				postData.user = results.userInfo[0];
				postData.topic = results.topicInfo;

				// Username override for guests, if enabled
				if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(postData.uid, 10) === 0 && data.handle) {
					postData.user.username = validator.escape(data.handle);
				}

				if (results.settings.followTopicsOnReply) {
					Topics.follow(postData.tid, uid);
				}
				postData.index = results.postIndex - 1;
				postData.favourited = false;
				postData.votes = 0;
				postData.display_moderator_tools = true;
				postData.display_move_tools = true;
				postData.selfPost = false;
				postData.relativeTime = utils.toISOString(postData.timestamp);

				if (parseInt(uid, 10) && data.req) {
					Topics.notifyFollowers(postData, uid);
					user.setUserField(uid, 'lastonline', Date.now());
				}

				if (postData.index > 0) {
					plugins.fireHook('action:topic.reply', postData);
				}

				postData.topic.title = validator.escape(postData.topic.title);
				next(null, postData);
			}
		], callback);
	};

	function checkContentLength(content, callback) {
		if (!content || content.length < parseInt(meta.config.miminumPostLength, 10)) {
			return callback(new Error('[[error:content-too-short, '  + meta.config.minimumPostLength + ']]'));
		} else if (content.length > parseInt(meta.config.maximumPostLength, 10)) {
			return callback(new Error('[[error:content-too-long, '  + meta.config.maximumPostLength + ']]'));
		}
		callback();
	}

	function guestHandleValid(data) {
		if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(data.uid, 10) === 0 &&
			data.handle && data.handle.length > meta.config.maximumUsernameLength) {
			return false;
		}
		return true;
	}

};
