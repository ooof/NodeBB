'use strict';

/* globals define */

define('composer/record', ['csrf'], function (csrf) {
	console.log('record');
	var recordModal = $('#record-modal'),
		recordModalError = $('#record-modal-error'),
		recordStart = recordModal.find('.record-start'),
		recordStop = recordModal.find('.record-stop'),
		recordComplete = recordModal.find('.record-complete');

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
	}

	function startRecording() {
		recordStart.attr('disabled', 'disabled');
		recordStop.removeAttr('disabled');
		recorder && recorder.record();
		__log('Recording...');
	}

	function stopRecording() {
		recordStop.attr('disabled', 'disabled');
		recordStart.removeAttr('disabled');
		recorder && recorder.stop();
		__log('Stopped recording.');

		// create WAV download link using audio data blob
		createDownloadLink();

		recorder.clear();
	}

	function createDownloadLink() {
		recorder && recorder.exportWAV(function (blob) {
			fileList.push({file: blob});
			var url = URL.createObjectURL(blob);
			var li = document.createElement('li');
			var au = document.createElement('audio');

			au.controls = true;
			au.src = url;
			li.appendChild(au);
			$(li).appendTo(recordModal.find('.record-list'));
		});
	}

	function init() {
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
	}

	recordStart.on('click', function () {
		startRecording();
	});
	recordStop.on('click', function () {
		stopRecording();
	});
	recordComplete.on('click', function () {
		recordModal.modal('hide');
	});

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
		emptyFileList: function () {
			fileList.length = 0;
			recordModal.modal('hide');
		}
	}
});
