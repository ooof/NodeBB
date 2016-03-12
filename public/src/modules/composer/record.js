'use strict';

/* globals define app */

define('composer/record', ['csrf'], function (csrf) {
	var recordToggle,
		recordList;

	var upload = function (item) {
		var uploadUrl = config.relative_path + '/api/uploadrecord';
		return new Promise(function (resolve, reject) {
			var formData = new FormData();
			formData.append('file', item.file);
			formData.append('key', item.key);

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

	function __log(e, data) {
		console.log("\n" + e + " " + (data || ''));
	}

	var audio_context;
	var recorder;
	var fileList = [];

	function startUserMedia(stream) {
		var input = audio_context.createMediaStreamSource(stream);

		// Uncomment if you want the audio to feedback directly
		//input.connect(audio_context.destination);
		//__log('Input connected to audio context destination.');

		recorder = new Recorder(input);
		recorder.recordingFlag = false;
	}

	function startRecording() {
		if (!recorder) return;
		recordToggle.addClass('record-red');
		recorder.record();
		recorder.recordingFlag = true;
		__log('Recording...');
	}

	function stopRecording() {
		recordToggle.removeClass('record-red');
		recorder && recorder.stop();
		recorder.recordingFlag = false;
		__log('Stopped recording.');

		// create WAV download link using audio data blob
		createDownloadLink();

		recorder.clear();
	}

	function createDownloadLink() {
		recorder && recorder.exportWAV(function (blob) {
			var id = parseInt(('' + Math.random()).substr(3, 3), 10);
			fileList.push({file: blob, id: id});
			var url = URL.createObjectURL(blob);
			var li = document.createElement('li');
			var au = document.createElement('audio');
			var deleteBtn = document.createElement('i');
			deleteBtn.className = 'fa fa-times delete-record';

			au.controls = true;
			au.src = url;
			li.appendChild(au);
			li.appendChild(deleteBtn);
			li.dataset.id = id;
			var liEl = $(li);
			liEl.appendTo(recordList);
		});
	}

	function init(postContainer) {
		if (recorder) return;
		try {
			// webkit shim
			window.AudioContext = window.AudioContext || window.webkitAudioContext;
			navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
			window.URL = window.URL || window.webkitURL;

			audio_context = new AudioContext;
			__log('Audio context set up.');
			__log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
		} catch (e) {
			alert('No web audio support in this browser!');
		}

		navigator.getUserMedia({audio: true}, startUserMedia, function (e) {
			__log('No live audio input: ' + e);
		});

		initEvent(postContainer);
	}

	function initEvent(container) {
		recordToggle = container.find('[data-format="record-toggle"]');
		recordList = container.find('.record-list');

		recordList.on('click', function (event) {
			var target = $(event.target);
			if (target.hasClass('delete-record')) {
				var li = target.parent('li');
				var id = li.data('id');
				fileList.map(function (file, i) {
					if (file.id === parseInt(id, 10)) {
						fileList.splice(i, 1);
					}
				});
				li.remove();
			}
		});
		recordToggle.on('click', function () {
			if (!recorder) {
				return;
			}
			if (!recorder.recordingFlag) {
				startRecording();
			} else if (recorder.recordingFlag) {
				stopRecording();
			}
		});
	}

	return {
		init: init,
		getFileList: function () {
			return fileList;
		},
		uploadFileList: function (callback) {
			return Promise.all(fileList.map(upload)).then(function (data) {
				callback && callback(data);
			});
		},
		startRecording: startRecording,
		stopRecording: stopRecording,
		emptyFileList: function () {
			fileList.length = 0;
			recordList.html('');
			recorder = undefined;
		}
	}
});
