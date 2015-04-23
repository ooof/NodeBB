"use strict";
/* globals define, config, socket, app, ajaxify, templates */

define('forum/invite/composer', ['translator'], function (translator) {
	var inviteComposer = {},
		validationError = false;

	inviteComposer.init = function () {
		var username = $('#username'),
			email = $('#email');

		username.on('blur', function () {
			if (username.val().length) {
				validateUsername(username.val().trim())
			}
		});

		email.on('blur', function () {
			if (email.val().length) {
				validateEmail(email.val().trim());
			}
		});
	};


	inviteComposer.validateForm = function (callback) {
		validationError = false;

		validateUsername(username.val().trim(), function () {
			validateEmail(email.val().trim(), callback);
		});
	};

	function validateUsername(username, callback) {
		callback = callback || function () {};
		var username_notify = $('#username-notify'),
			successIcon = '<i class="fa fa-check"></i>';

		if (username.length < config.minimumUsernameLength) {
			showError(username_notify, '[[error:username-too-short]]');
		} else if (username.length > config.maximumUsernameLength) {
			showError(username_notify, '[[error:username-too-long]]');
		} else if (!utils.isUserNameValid(username) || !utils.slugify(username)) {
			showError(username_notify, '[[error:invalid-username]]');
		} else {
			socket.emit('invite.usernameExists', {
				username: username
			}, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}

				if (data.exists) {
					showError(username_notify, data.msg);
				} else {
					showSuccess(username_notify, successIcon, data.msg);
				}

				callback();
			});
		}
	}

	function validateEmail(email, callback) {
		callback = callback || function () {};
		var email_notify = $('#email-notify'),
			successIcon = '<i class="fa fa-check"></i>';

		if (!utils.isEmailValid(email)) {
			showError(email_notify, '[[error:invalid-email]]');
			return callback();
		}

		socket.emit('invite.emailExists', {
			email: email
		}, function (err, data) {
			if (err) {
				app.alertError(err.message);
				return callback();
			}

			if (data.exists) {
				showError(email_notify, data.msg);
			} else {
				showSuccess(email_notify, successIcon, data.msg);
			}

			callback();
		});
	}

	function showError(element, msg) {
		var postEl = $('[data-action="post"]');

		postEl.add(postEl.next()).attr('disabled', 'disabled');

		translator.translate(msg, function (msg) {
			element.html(msg);
			element.parent()
				.removeClass('alert-success')
				.addClass('alert-danger');
			element.show();
		});

		validationError = true;
	}

	function showSuccess(element, msg, msgPlus) {
		var postEl = $('[data-action="post"]');

		postEl.add(postEl.next()).removeAttr('disabled');

		translator.translate(msg, function (msg) {
			if (msgPlus) {
				element.html(msgPlus);
			} else {
				element.html(msg);
			}
			element.parent()
				.removeClass('alert-danger')
				.addClass('alert-success');
			element.show();
		});
	}

	return inviteComposer;
});
