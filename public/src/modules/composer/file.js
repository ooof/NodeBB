'use strict';

/* globals define app */

define('composer/file', ['csrf'], function (csrf) {
	var fileListEl;
	var fileList = [];

	function createDownloadLink(data) {
		var li = document.createElement('li');
		var hrefEl = document.createElement('a');
		var deleteBtn = document.createElement('i');
		deleteBtn.className = 'fa fa-times delete-file';

		hrefEl.href = data.url;
		hrefEl.text = data.name;
		li.appendChild(hrefEl);
		li.appendChild(deleteBtn);
		li.dataset.url = data.url;
		var liEl = $(li);
		liEl.appendTo(fileListEl);
	}

	function init(container) {
		fileListEl = container.find('.file-list');

		fileListEl.on('click', function (event) {
			var target = $(event.target);
			if (target.hasClass('delete-file')) {
				var li = target.parent('li');
				var url = li.data('url');
				fileList.map(function (file, i) {
					if (file.url === url) {
						fileList.splice(i, 1);
					}
				});
				li.remove();
			}
		});
	}

	function upload(item) {
		var uploadUrl = config.relative_path + '/api/uploadfile';
		return new Promise(function (resolve, reject) {
			var formData = new FormData();
			formData.append('file', item.file);
			formData.append('name', 'file-test');

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
					var response = JSON.parse(xhr.responseText)[0];
					fileList.push(response);
					createDownloadLink(response);
					resolve(response);
				}
			};
			// 执行上传操作
			xhr.send(formData);
		});
	}

	return {
		init: init,
		upload: upload,
		getFileList: function () {
			return fileList;
		}
	}
});
