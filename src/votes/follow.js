'use strict';

var async = require('async'),
	nconf = require('nconf'),
	S = require('string'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	postTools = require('../postTools'),
	notifications = require('../notifications'),
	meta = require('../meta'),
	emailer = require('../emailer');

module.exports = function(Votes) {
};
