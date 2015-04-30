'use strict';

var db = require('../database'),
	nconf = require('nconf'),
	async = require('async'),
	meta = require('../meta'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins'),
	user = require('../user'),
	invite = require('../invite'),
	jobs = require('../schedule'),
	emailer = require('../emailer');

module.exports = function (Invite) {
	Invite.isOwner = function (iid, uid, callback) {
		uid = parseInt(uid, 10);
		if (!uid) {
			return callback(null, false);
		}
		Invite.getInviteField(iid, 'uid', function (err, author) {
			callback(err, parseInt(author, 10) === uid);
		});
	};

	function getDataForValidate (iid, withSlug, callback) {
		Invite.getInviteFields(iid, ['status', 'slug'], function (err, inviteData) {
			if (err) {
				return callback(err);
			}
			var data = {
					exists: !!iid
				},
				slugTag = '<a href="' + nconf.get('relative_path') + 'invite/' + inviteData.slug + '" target="_blank">点击查看</a>';
			if (inviteData.status === 'voting') {
				data.msg = '正在投票中';
			} else if (inviteData.status === 'invited') {
				data.msg = '已被提名，并已发送邮件邀请加入';
			} else if (inviteData.status === 'joined') {
				data.msg = '已加入';
			} else if (inviteData.status === 'failed') {
				data.exists = false;
				data.msg = '已被提名，但邀请失败，可再次提名此人';
			} else {
				data.msg = '';
			}
			if (withSlug && data.msg) {
				data.msg = data.msg + '，' + slugTag;
			}
			callback (null, data);
		})
	}

	function registerUsernameExists(data, username, callback) {
		user.exists(utils.slugify(username), function (err, exist) {
			data.exists = exist;
			if (exist) {
				data.msg = '该用户已存在';
			}
			callback(null, data);
		});
	}

	Invite.usernameExists = function(username, callback) {
		var data = {};
		async.waterfall([
			function (next) {
				Invite.getIidByUsername(username, next);
			},
			function (iid, next) {
				if (!iid) {
					return registerUsernameExists(data, username, callback);
				}
				next(null, iid);
			},
			function (iid, next) {
				getDataForValidate(iid, true, next);
			}
		], callback);
	};

	Invite.emailExists = function(email, callback) {
		var data = {};
		async.waterfall([
			function (next) {
				Invite.getIidByEmail(email.toLowerCase(), next);
			},
			function (iid, next) {
				if (!iid) {
					return callback(null, data)
				}
				next(null, iid);
			},
			function (iid, next) {
				getDataForValidate(iid, false, next);
			}
		], callback);
	};

	Invite.getIidByEmail = function(email, callback) {
		db.getObjectField('email:iid', email.toLowerCase(), callback);
	};

	Invite.getIidByUsername = function(username, callback) {
		if (!username) {
			return callback();
		}
		db.getObjectField('username:iid:invite', username, callback);
	};

	Invite.inviteUser = function (uid, inviteData, callback) {
		var iid = inviteData.iid;

		async.waterfall([
			function (next) {
				db.getObjectFields('invite:' + iid, ['slug', 'username'], next);
			},
			function (inviteData, next) {
				Invite.notificationUserInvited(inviteData, uid, iid, next);
			},
			function (next) {
				// 给被提名人发送邮件邀请
				Invite.sendInviteEmail(inviteData.uid, iid, next);
			},
			function (next) {
				// 如果有多个人投票时，给提名人发送邮件告知提名已通过
				if (inviteData.inviteCount === 1) {
					return next();
				}
				Invite.sendSuccessEmail(inviteData, next);
			},
			function (next) {
				jobs.setWarn(iid, Date.now(), next);
			}
		], callback);
	};
};
