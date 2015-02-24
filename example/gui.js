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

var audioContext = null;
var pitchDetector = null;

var theBuffer = null;

var DEBUGCANVAS = null;
var detectorElem, 
	canvas,
	pitchElem,
	noteElem,
	detuneElem,
	detuneAmount;

window.onload = function() {
	audioContext = new AudioContext();

	var request = new XMLHttpRequest();
	request.open("GET", "./whistling3.ogg", true);
	request.responseType = "arraybuffer";
	request.onload = function() {
	  audioContext.decodeAudioData( request.response, function(buffer) { 
	    	theBuffer = buffer;
		} );
	};
	request.send();

	detectorElem = document.getElementById( "detector" );
	DEBUGCANVAS = document.getElementById( "waveform" );
	if (DEBUGCANVAS) {
		canvas = DEBUGCANVAS.getContext("2d");
		canvas.strokeStyle = "black";
		canvas.lineWidth = 1;
	}
	pitchElem = document.getElementById( "pitch" );
	noteElem = document.getElementById( "note" );
	detuneElem = document.getElementById( "detune" );
	detuneAmount = document.getElementById( "detune_amt" );

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
};

function toggleOscillator() {
	if(pitchDetector) pitchDetector.destroy();
    sourceNode = audioContext.createOscillator();
    sourceNode.frequency = 440;
    sourceNode.start(0);
    pitchDetector = new PitchDetector({
    	context: audioContext,
    	callback: draw,
    	input: sourceNode,
    	maxFrequency: 500,
    	minFrequency: 300,
    	//minNote: 60,
    	//maxNote: 80,
    	//note: 69,
    	//output: audioContext.destination,
    	start: true
    });
}

function toggleLiveInput() {
	if(pitchDetector) pitchDetector.destroy();
	pitchDetector = new PitchDetector({
    	context: audioContext,
    	callback: draw,
    	maxNote: 100,
    	minNote: 50,
    	minRms: 0.1,
    	// default input node is microphone
    	start: true
    });
}

function togglePlayback() {
	if(pitchDetector) pitchDetector.destroy();

    var sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = theBuffer;
    sourceNode.loop = true;
    sourceNode.start(0);

    pitchDetector = new PitchDetector({
    	context: audioContext,
    	callback: draw,
    	input: sourceNode,
    	maxNote: 100,
    	minNote: 60,
    	output: audioContext.destination,
    	start: true
    });
}

function stop(){
	if(pitchDetector) pitchDetector.destroy();
	pitchDetector = null;
}

function draw( pitch ) {
	if(!pitchDetector || !pitchDetector.buffer) return;
	var buf = pitchDetector.buffer;
	var i = 0, val = 0, len = 0;

	if (DEBUGCANVAS) {  // This draws the current waveform, useful for debugging
	    var start = pitchDetector.periods[0];
		var end = pitchDetector.periods[pitchDetector.periods.length-1];
		
		canvas.clearRect(0,0,512,256);

		canvas.fillStyle = "yellow";
		canvas.fillRect(start,0,end-start,(1-pitchDetector.minCorrelation) * 256);

		canvas.fillStyle = "#EEEEEE";
		var height = pitchDetector.rms * 256;
		canvas.fillRect(0,256-height,512,height);

		canvas.strokeStyle = "black";
		canvas.beginPath();
		canvas.moveTo(0,256 - pitchDetector.minRms * 256);
		canvas.lineTo(512,256 - pitchDetector.minRms * 256);
		canvas.stroke();

		canvas.strokeStyle = "green";
		canvas.beginPath();
		canvas.moveTo(start,0);
		canvas.lineTo(start,256);
		canvas.moveTo(end,0);
		canvas.lineTo(end,256);
		canvas.moveTo(start,256 - 256 * pitchDetector.minCorrelation);
		canvas.lineTo(end,256 - 256 * pitchDetector.minCorrelation);
		canvas.stroke();

		canvas.beginPath();
		canvas.strokeStyle = "black";
		for(i = 0, len = pitchDetector.getPeriod() + 1; i<len; i++){
			val = pitchDetector.correlations[i] || 0;
			canvas.moveTo(i,256);
			canvas.lineTo(i,256 - (val * 256));
			canvas.moveTo(i,256);
		}
		canvas.stroke();


		// canvas.strokeStyle = "red";
		// canvas.beginPath();
		// canvas.moveTo(0,0);
		// canvas.lineTo(0,256);
		// canvas.moveTo(128,0);
		// canvas.lineTo(128,256);
		// canvas.moveTo(256,0);
		// canvas.lineTo(256,256);
		// canvas.moveTo(384,0);
		// canvas.lineTo(384,256);
		// canvas.moveTo(512,0);
		// canvas.lineTo(512,256);
		// canvas.stroke();

		// canvas.strokeStyle = "red";
		// canvas.beginPath();
		// canvas.moveTo(0,buf[0]);
		// for (var i=1;i<512;i++) {
		// 	canvas.lineTo(i,128+(buf[i]*128));
		// }
		// canvas.stroke();
	}

 	if (pitch == -1) {
 		detectorElem.className = "vague";
	 	pitchElem.innerText = "--";
		noteElem.innerText = "-";
		detuneElem.className = "";
		detuneAmount.innerText = "--";
 	} else {
	 	detectorElem.className = "confident";
	 	pitchElem.innerText = Math.round( pitch ) ;
	 	var note =  pitchDetector.getNoteNumber();
		noteElem.innerHTML = pitchDetector.getNoteString();
		var detune = pitchDetector.getDetune();
		if (detune === 0){
			detuneElem.className = "";
			detuneAmount.innerHTML = "--";
		} else {
			if (detune < 0)
				detuneElem.className = "flat";
			else
				detuneElem.className = "sharp";
			detuneAmount.innerHTML = Math.abs( detune );
		}
	}
}
