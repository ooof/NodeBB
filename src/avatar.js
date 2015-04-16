"use strict";

var fs = require('fs'),
	path = require('path'),
	nconf = require('nconf'),
	winston = require('winston'),
	async = require('async'),
	db = require('./database'),

	Avatar = {};

//TODO 当文件名重复的时候处理方案

Avatar.install = function (type, callback) {
	callback = callback || function (err) {
		if (err) {
			winston.error(err.stack);
			console.log(err.stack);
		}
	};

	var avatarPath;
	if (type === 'update') {
		avatarPath = path.join(__dirname, '../', 'install/avatar/');
	} else if (type === 'install') {
		avatarPath = path.join(__dirname, '../', 'public/images/avatar/');
	}
	getAvatar(avatarPath, function (err, avatars) {
		if (err) {
			return callback(err);
		}
		if (!Array.isArray(avatars) || !avatars.length) {
			return callback();
		}
		setAvatarToDatabase(type, avatars, callback);
	});
};

// 获取随机头像
Avatar.getRandAvatar = function (callback) {
	db.getSetRandMember('users:avatar', function (err, avatar) {
		if (err) {
			winston.error(err.stack);
			console.log(err.stack);
		}
		removeAvatar(avatar);
		callback(avatar);
	});
};

function removeAvatar(avatar) {
	db.setRemove('users:avatar', avatar);
}

function getAvatar(avatarPath, callback) {
	fs.exists(avatarPath, function (exists) {
		if (exists) {
			fs.readdir(avatarPath, callback);
		}
	});
}

function setAvatarToDatabase(type, avatars, callback) {
	// user:avatars 预置用户头像
	async.each(avatars, function (avatar, next) {
		db.setAdd('users:avatar', avatar, next);
	}, function (err) {
		if (err) {
			return callback(err);
		}
		if (type === 'update') {
			var sourceDir = path.join(__dirname, '../', 'install/avatar/*'),
				targetDir = path.join(__dirname, '../', 'public/images/avatar'),
				command = 'mv' + ' ' + sourceDir + ' ' + targetDir;

			require('child_process').exec(command);
		}
		callback();
	});
}

module.exports = Avatar;
