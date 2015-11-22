'use strict';

var async = require('async'),
	winston = require('winston'),
	_ = require('underscore'),
	crypto = require('crypto'),
	path = require('path'),
	nconf = require('nconf'),
	fs = require('fs'),
	validator = require('validator'),

	user = require('./user'),
	meta = require('./meta'),
	db = require('./database'),
	plugins = require('./plugins'),
	posts = require('./posts'),
	privileges = require('./privileges'),
	utils = require('../public/src/utils'),
	util = require('util'),

	uploadsController = require('./controllers/uploads');

(function (GroupsPrivacy) {

	var ephemeralGroups = ['guests'],

		internals = {
			filterGroups: function (groups, options) {
				// Remove system, hidden, or deleted groups from this list
				if (groups && !options.showAllGroups) {
					return groups.filter(function (group) {
						if (!group) {
							return false;
						}
						if (group.deleted || (group.hidden && !(group.system || group.isMember || options.isAdmin || group.isInvited)) || (!options.showSystemGroups && group.system)) {
							return false;
						} else if (options.removeEphemeralGroups && ephemeralGroups.indexOf(group.name) !== -1) {
							return false;
						} else {
							return true;
						}
					});
				} else {
					return groups;
				}
			},
			getEphemeralGroup: function (groupName) {
				return {
					name: groupName,
					slug: utils.slugify(groupName),
					description: '',
					deleted: '0',
					hidden: '0',
					system: '1'
				};
			},
			removeEphemeralGroups: function (groups) {
				var x = groups.length;
				while (x--) {
					if (ephemeralGroups.indexOf(groups[x]) !== -1) {
						groups.splice(x, 1);
					}
				}

				return groups;
			},
			isPrivilegeGroup: /^cid:\d+:privileges:[\w:]+$/
		};

	GroupsPrivacy.exists = function (name, callback) {
		if (Array.isArray(name)) {
			var slugs = name.map(function (groupName) {
				return utils.slugify(groupName);
			});
			async.parallel([
				function (next) {
					callback(null, slugs.map(function (slug) {
						return ephemeralGroups.indexOf(slug) !== -1;
					}));
				},
				async.apply(db.isSortedSetMembers, 'groupPrivacys:createTime', name)
			], function (err, results) {
				if (err) {
					return callback(err);
				}

				callback(null, results.map(function (result) {
					return result[0] || result[1];
				}));
			});
		} else {
			var slug = utils.slugify(name);
			async.parallel([
				function (next) {
					next(null, ephemeralGroups.indexOf(slug) !== -1);
				},
				async.apply(db.isSortedSetMember, 'groupPrivacy:createTime', name)
			], function (err, results) {
				callback(err, !err ? (results[0] || results[1]) : null);
			});
		}
	};

	GroupsPrivacy.existsBySlug = function (slug, callback) {
		if (Array.isArray(slug)) {
			db.isObjectFields('groupPrivacySlug:groupName', slug, callback);
		} else {
			db.isObjectField('groupPrivacySlug:groupName', slug, callback);
		}
	};

	GroupsPrivacy.create = function (data, callback) {
		if (data.name.length === 0) {
			return callback(new Error('[[error:group-name-too-short]]'));
		}

		if (data.name === 'administrators' || data.name === 'registered-users' || internals.isPrivilegeGroup.test(data.name)) {
			var system = true;
		}

		var timestamp = data.timestamp || Date.now();

		var slug = utils.slugify(data.name),
			groupData = {
				name: data.name,
				slug: slug,
				createtime: timestamp,
				userTitle: data.name,
				description: data.description || '',
				memberCount: 0,
				deleted: '0',
				hidden: data.hidden || '0',
				system: system ? '1' : '0',
				private: data.private || '1'
			},
			tasks = [
				async.apply(db.sortedSetAdd, 'groupPrivacy:createTime', timestamp, data.name),
				async.apply(db.setObject, 'groupPrivacy:' + data.name, groupData)
			];

		if (data.hasOwnProperty('ownerUid')) {
			tasks.push(async.apply(db.setAdd, 'groupPrivacy:' + data.name + ':owners', data.ownerUid));
			tasks.push(async.apply(db.sortedSetAdd, 'groupPrivacy:' + data.name + ':members', timestamp, data.ownerUid));
			tasks.push(async.apply(db.setObjectField, 'groupPrivacy:' + data.name, 'memberCount', 1));

			groupData.ownerUid = data.ownerUid;
		}

		if (!data.hidden) {
			tasks.push(async.apply(db.setObjectField, 'groupPrivacySlug:groupName', slug, data.name));
		}

		async.series(tasks, function (err) {
			callback(err, groupData);
		});
	};

}(module.exports));
