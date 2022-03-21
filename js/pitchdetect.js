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
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var detectorElem, 
	canvasElem,
	waveCanvas,
	pitchElem,
	noteElem,
	detuneElem,
	detuneAmount;

window.onload = function() {
	audioContext = new AudioContext();
	MAX_SIZE = Math.max(4,Math.floor(audioContext.sampleRate/5000));	// corresponds to a 5kHz signal
	var request = new XMLHttpRequest();
	request.open("GET", "../sounds/whistling3.ogg", true);
	request.responseType = "arraybuffer";
	request.onload = function() {
	  audioContext.decodeAudioData( request.response, function(buffer) { 
	    	theBuffer = buffer;
		} );
	}
	request.send();

	detectorElem = document.getElementById( "detector" );
	canvasElem = document.getElementById( "output" );
	DEBUGCANVAS = document.getElementById( "waveform" );
	if (DEBUGCANVAS) {
		waveCanvas = DEBUGCANVAS.getContext("2d");
		waveCanvas.strokeStyle = "black";
		waveCanvas.lineWidth = 1;
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



}

function error() {
    alert('Stream generation failed.');
}

function getUserMedia(dictionary, callback) {
    try {
        navigator.getUserMedia = 
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;
        navigator.getUserMedia(dictionary, callback, error);
    } catch (e) {
        alert('getUserMedia threw exception :' + e);
    }
}

function gotStream(stream) {
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect( analyser );
    updatePitch();
}

function toggleOscillator() {
    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
        return "play oscillator";
    }
    sourceNode = audioContext.createOscillator();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect( analyser );
    analyser.connect( audioContext.destination );
    sourceNode.start(0);
    isPlaying = true;
    isLiveInput = false;
    updatePitch();

    return "stop";
}

function toggleLiveInput() {
    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
    }
    getUserMedia(
    	{
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream);
}

function togglePlayback() {
    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
        return "start";
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = theBuffer;
    sourceNode.loop = true;

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect( analyser );
    analyser.connect( audioContext.destination );
    sourceNode.start( 0 );
    isPlaying = true;
    isLiveInput = false;
    updatePitch();

    return "stop";
}

var rafID = null;
var tracks = null;
var buflen = 2048;
var buf = new Float32Array( buflen );

var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromPitch( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return Math.round( noteNum ) + 69;
}

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function centsOffFromPitch( frequency, note ) {
	return Math.floor( 1200 * Math.log( frequency / frequencyFromNoteNumber( note ))/Math.log(2) );
}

function getMaxPos(c, SIZE) {
    let d = 0;
    while (c[d] > c[d + 1]) {
        d++;
    }

    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    return maxpos;
}

function calcBufferArray(buf) {
    let c = new Array(buf.length).fill(0);
    for (let i = 0; i < buf.length; i++) {
        for (let j = 0; j < buf.length - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }
    return c;
}

function notEnoughSignal(buf) {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) {
        rms += buf[i] * buf[i];
    }
    rms = Math.sqrt(rms / buf.length);
    return rms < 0.01
}

function getSignalStart(buf, threshold) {
    let start = 0;
    for (let i = 0; i < buf.length / 2; i++) {
        if (Math.abs(buf[i]) < threshold) {
            start = i;
            break;
        }
    }
    return start;
}

function getSignalEnd(buf, threshold) {
    let end = buf.length - 1;
    for (let i = 1; i < buf.length / 2; i++) {
        if (Math.abs(buf[buf.length - i]) < threshold) {
            end = buf.length - i;
            break;
        }
    }
    return end;
}

function getMax(buf) {
    const correlated = calcBufferArray(buf);
    let max = getMaxPos(correlated, buf.length);
    const maxA = (correlated[max - 1] + correlated[max + 1] - 2 * correlated[max]) / 2;
    const maxB = (correlated[max + 1] - correlated[max - 1]) / 2;
    if (maxA >= 0) {
        max = max - maxB / (2 * maxA);
    }
    return max;
}

// ACF2+ algorithm
function autoCorrelate(buf, sampleRate) {
    if (notEnoughSignal(buf)) {
        return -1;
    }
    const threshold = 0.2;    
    buf = buf.slice(getSignalStart(buf, threshold), getSignalEnd(buf, threshold));
    return sampleRate / getMax(buf);
}

function updatePitch( time ) {
	var cycles = new Array;
	analyser.getFloatTimeDomainData( buf );
	var ac = autoCorrelate( buf, audioContext.sampleRate );
	// TODO: Paint confidence meter on canvasElem here.

	if (DEBUGCANVAS) {  // This draws the current waveform, useful for debugging
		waveCanvas.clearRect(0,0,512,256);
		waveCanvas.strokeStyle = "red";
		waveCanvas.beginPath();
		waveCanvas.moveTo(0,0);
		waveCanvas.lineTo(0,256);
		waveCanvas.moveTo(128,0);
		waveCanvas.lineTo(128,256);
		waveCanvas.moveTo(256,0);
		waveCanvas.lineTo(256,256);
		waveCanvas.moveTo(384,0);
		waveCanvas.lineTo(384,256);
		waveCanvas.moveTo(512,0);
		waveCanvas.lineTo(512,256);
		waveCanvas.stroke();
		waveCanvas.strokeStyle = "black";
		waveCanvas.beginPath();
		waveCanvas.moveTo(0,buf[0]);
		for (var i=1;i<512;i++) {
			waveCanvas.lineTo(i,128+(buf[i]*128));
		}
		waveCanvas.stroke();
	}

 	if (ac == -1) {
 		detectorElem.className = "vague";
	 	pitchElem.innerText = "--";
		noteElem.innerText = "-";
		detuneElem.className = "";
		detuneAmount.innerText = "--";
 	} else {
	 	detectorElem.className = "confident";
	 	pitch = ac;
	 	pitchElem.innerText = Math.round( pitch ) ;
	 	var note =  noteFromPitch( pitch );
		noteElem.innerHTML = noteStrings[note%12];
		var detune = centsOffFromPitch( pitch, note );
		if (detune == 0 ) {
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

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}
