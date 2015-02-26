/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

$(function(){
	// Global Variables
	var audioContext = new AudioContext();
	var osc = null;
	var options = {	start: true };
	var needsReset = true;
	var pitchDetector = null;
	var theBuffer = null;

	// Form Input Elements
	var inputs = {
		input: $('#input'),
		notes: $('#notes'),
		output: $('#output'),
		length: $('#length'),
		minRms: $('#minrms'),
		normalize:  $('#normalize'),
		detection: $('#detection'),
		minCorrelationIncrease: $('#strength'),
		minCorrelation: $('#correlation'),
		range: $('#range'),
		min: $('#min'),
		max: $('#max'),
		draw: $('#draw'),
		stopAfterDetection: $('#stopAfterDetection')
	};


	var data = JSON.parse(localStorage.getItem('pitch-detector-settings')) || {};
	for(var x in data){
		inputs[x].val(data[x]);
	}

	// GUI Elements
	var gui = {
		detector: $('#detector'),
		canvas: $('#waveform'),
		pitch: $('#pitch'),
		note: $('#note'),
		detuneBox: $('#detune'),
		detune: $('#detune_amt')
	};

	// Canvas Element
	canvasEl = $("#waveform").get(0);
	canvas = canvasEl.getContext("2d");
	window.savePic = function(){
		window.open(canvasEl.toDataURL("image/png"));
	};

	// Show/Hide Stuff on Form Change
	inputs.input.change(function(e){
		needsReset = true;
		var val = inputs.input.val();
		if(val === 'mic') {
			$('#notes').removeClass('invisible');
		} else {
			$('#notes').addClass('invisible');
		}
	});

	inputs.output.change(function(e){
		needsReset = true;
	});

	inputs.length.change(function(e){
		needsReset = true;
	});

	inputs.range.change(function(e){
		var val = inputs.range.val();
		if(val !== 'none') {
			$('.range').removeClass('hidden');
		} else {
			$('.range').addClass('hidden');
		}
	});

	inputs.detection.change(function(e){
		var val = inputs.detection.val();
		$('.strength').addClass('hidden');
		$('.correlation').addClass('hidden');
		if(val === 'strength') {
			$('.strength').removeClass('hidden');
		} else if(val === 'correlation') {
			$('.correlation').removeClass('hidden');
		}
	});

	// Drag & Drop audio files
	var detectorElem = gui.detector.get(0);
	detectorElem.ondragenter = function () { 
		this.classList.add("droptarget"); 
		return false; };
	detectorElem.ondragleave = function () { this.classList.remove("droptarget"); return false; };
	detectorElem.ondrop = function (e) {
  		this.classList.remove("droptarget");
  		e.preventDefault();
		theBuffer = null;

	  	var reader = new FileReader();
	  	reader.onload = function (event) {
	  		audioContext.decodeAudioData( event.target.result, function(buffer) {
	    		theBuffer = buffer;
	  		}, function(){alert("error loading!");} ); 

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(e.dataTransfer.files[0]);
	  	return false;
	};

	// Get example audio file
	var request = new XMLHttpRequest();
	request.open("GET", "./whistling3.ogg", true);
	request.responseType = "arraybuffer";
	request.onload = function() {
	  audioContext.decodeAudioData( request.response, function(buffer) { 
	    	theBuffer = buffer;
	    	console.log('loaded audio');
		} );
	};
	request.send();

	// Global Methods
	window.stopNote = function stopNote(){
		if(osc) {
			osc.stop();
			osc.disconnect();
			osc = null;
		}
	};

	window.playNote = function playNote(freq){
		stopNote();
		osc = audioContext.createOscillator();
		osc.connect(audioContext.destination);
		osc.frequency.value = freq;
		osc.start(0);
	};

	window.stop = function stop(){
		if(pitchDetector) pitchDetector.destroy();
		pitchDetector = null;
	};

	window.start = function start(){
		if(needsReset && pitchDetector) {
			pitchDetector.destroy();
			pitchDetector = null;
		}

		var input = inputs.input.val();
		var sourceNode;
		if(input === 'osc'){
			sourceNode = audioContext.createOscillator();
			sourceNode.frequency.value = 440;
			sourceNode.start(0);
		} else if(input === 'audio'){
			sourceNode = audioContext.createBufferSource();
		    sourceNode.buffer = theBuffer;
		    sourceNode.loop = true;
		    sourceNode.start(0);
		} else {
			inputs.output.prop('checked', false);
		}
		options.input = sourceNode;

		if(inputs.output.is(':checked')){
	   		options.output = audioContext.destination;
		}

		options.length = inputs.length.val() * 1;
		options.stopAfterDetection = inputs.stopAfterDetection.is(':checked');

		for(var key in options){
			if(/^(min|max)/.test(key)){
				delete options[key];
			}
		}

		options.minRms = 1.0 * inputs.minRms.val() || 0.01;
		var normalize = inputs.normalize.val();
		if(normalize !== 'none'){
			options.normalize = normalize;
		} else {
			options.normalize = false;
		}

		var detection = inputs.detection.val();
		options.minCorrelationIncrease = false;
		options.minCorrelation = false;
		if(detection === 'correlation'){
			options.minCorrelation = inputs.minCorrelation.val() * 1.0;
		} else if(detection === 'strength') {
			options.minCorrelationIncrease = inputs.minCorrelationIncrease.val() * 1.0;
		}

		var range = inputs.range.val();// Frequency, Period, Note
		if(range !== 'none'){
			options['min'+range] = inputs.min.val() * 1.0;
			options['max'+range] = inputs.max.val() * 1.0;
		} 

		options.onDebug = false;
		options.onDetect = false;
		options[inputs.draw.val()] = draw;

		options.context = audioContext;
		if(needsReset || !pitchDetector){
			console.log('created PitchDetector',options);
			pitchDetector = new PitchDetector(options);
			needsReset = false;
		} else {
			pitchDetector.setOptions(options,true);
		}
		delete options.context;
		delete options.output;
		delete options.input;
		$('#settings').text(JSON.stringify(options,null,4));
		window.pitchDetector = pitchDetector;

		var data = {};
		for(x in inputs){
			var el = inputs[x];
			data[x] = el.val();
		}
		localStorage.setItem('pitch-detector-settings',JSON.stringify(data));
	};

	function draw( stats, detector ) {
		PitchDetectorCanvasDraw(canvas, stats, detector);

		// Update Pitch Detection GUI
	 	if (!stats.detected) {
	 		gui.detector.attr('class','vague');
	 		gui.pitch.text('--');
	 		gui.note.text('-');
	 		gui.detuneBox.attr('class','');
	 		gui.detune.text('--');
	 	} else {
	 		gui.detector.attr('class','confident');
		 	var note =  detector.getNoteNumber();
			var detune = detector.getDetune();
		 	gui.pitch.text( Math.round( stats.frequency ) );
			gui.note.text(detector.getNoteString());
			if (detune === 0){
		 		gui.detuneBox.attr('class','');
		 		gui.detune.text('--');
			} else {
				if (detune < 0)
	 				gui.detuneBox.attr('class','flat');
				else
	 				gui.detuneBox.attr('class','sharp');
	 			gui.detune.text(Math.abs( detune ));
			}
		}
	}

});