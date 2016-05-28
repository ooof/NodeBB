'use strict';

/* globals define app */

define('composer/image', ['csrf'], function (csrf) {
	var upload = function (item) {
		var uploadUrl = config.relative_path + '/api/uploadimage';
		return new Promise(function (resolve, reject) {
			var formData = new FormData();
			formData.append('file', item.file);
			formData.append('name', 'image-test');

			var xhr = new XMLHttpRequest();
			xhr.open('POST', uploadUrl, true);
			xhr.setRequestHeader('x-csrf-token', csrf.get());

			// upload and notify progress
			xhr.upload.addEventListener('progress', function (e) {
				//if (e.lengthComputable)
				//  var percent = Math.round(e.loaded * 100 / e.total);
			}, false);

			// transferFailed
			xhr.upload.addEventListener('error', reject);

			xhr.onreadystatechange = function () {
				// transferComplete
				if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseText !== "") {
					resolve(JSON.parse(xhr.responseText)[0]);
				}
			};
			// 执行上传操作
			xhr.send(formData);
		});
	};

	return {
		upload: upload
	}
});
