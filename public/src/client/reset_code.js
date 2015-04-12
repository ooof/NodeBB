"use strict";
/*globals define, app, ajaxify, socket, RELATIVE_PATH*/

define('forum/reset_code', ['password'], function (passwordComplex) {
	var	ResetCode = {};

	ResetCode.init = function() {
		var reset_code = ajaxify.variables.get('reset_code');

		var resetEl = $('#reset'),
			password = $('#password'),
			repeat = $('#repeat'),
			noticeEl = $('#notice');

		resetEl.on('click', function() {
			var pw = password.val();
			passwordComplex(pw, function (complex, passwordMatch) {
				if (complex < 10 && pw.length >= config.minimumPasswordLength) {
					// 检查密码强度
					app.alertError('[[invite:password.simple]]');
				} else if (pw.length < config.minimumPasswordLength) {
					app.alertError('[[reset_password:password_too_short]]');
				} else if (!utils.isPasswordValid(pw)) {
					app.alertError('[[user:change_password_error]]');
				} else if (passwordMatch < 3) {
					app.alertError('[[user:password]]');
				} else if (password.val() !== repeat.val()) {
					app.alertError('[[reset_password:passwords_do_not_match]]');
				} else {
					resetEl.prop('disabled', true).html('<i class="fa fa-spin fa-refresh"></i> Changing Password');
					socket.emit('user.reset.commit', {
						code: reset_code,
						password: password.val()
					}, function(err) {
						if (err) {
							ajaxify.refresh();
							return app.alertError(err.message);
						}

						window.location.href = RELATIVE_PATH + '/login';
					});
				}
			});

			return false;
		});
	};

	return ResetCode;
});
