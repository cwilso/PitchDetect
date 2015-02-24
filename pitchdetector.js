
/*
The MIT License (MIT)

Copyright (c) 2014-2015 Chris Wilson, modified by Mark Marijnissen

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

(function(){
var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function frequencyToNote( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return Math.round( noteNum ) + 69;
}

function frequencyToString( frequency ){
	var note = frequencyToNote(frequency);
	return noteStrings[note % 12] + Math.floor((note-12) / 12);
}

function noteToFrequency( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function noteToPeriod (note, sampleRate) {
	return sampleRate / noteToFrequency(note);
}

function centsOffFromPitch( frequency, note ) {
	return Math.floor( 1200 * Math.log( frequency / noteToFrequency( note ))/Math.log(2) );
}

function getLiveInput(callback){
	try {
	    navigator.getUserMedia(
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
	        }, function(stream){
	        	var input = audioContext.createMediaStreamSource(stream);
	        	callback(null,input);
	        }, function(error){
	        	callback(error,null);
	        });
   	} catch(e) {
        callback(e,null);
   	}
}

// prefix fixes
var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

function PitchDetector(options){
	options = options || {};
	this.context = options.context;
	this.sampleRate = this.context.sampleRate;
	this.callback = options.callback || PitchDetector.defaultCallback.bind(this);

	this.minCorrelation = options.minCorrelation || 0.9;
	this.minRms = options.minRms || 0.01;
	this.stopAfterDetection = options.stopAfterDetection || false;

	this.buffer = new Float32Array( options.length || 1024 );
	this.MAX_SAMPLES = Math.floor(this.buffer.length/2);

	if(options.note){
		var period = Math.round(noteToPeriod(options.note,this.sampleRate));
		options.minPeriod = period - 1;
		options.maxPeriod = period + 1;
	}
	if(options.minNote){
		options.maxPeriod = Math.round(noteToPeriod(options.minNote,this.sampleRate));	
	}
	if(options.maxNote){
		options.minPeriod = Math.round(noteToPeriod(options.maxNote,this.sampleRate));	
	}
	if(options.minFrequency) {
		options.maxPeriod = Math.floor(this.sampleRate / options.minFrequency);
	}
	if(options.maxFrequency) {
		options.minPeriod = Math.ceil(this.sampleRate / options.maxFrequency);
	}
	if(!options.periods){
		this.periods = [];
		var minPeriod = options.minPeriod || 2;
		var maxPeriod = this.MAX_SAMPLES;
		if(options.maxPeriod && options.maxPeriod < maxPeriod){
			maxPeriod = options.maxPeriod;
		}
		if(maxPeriod - minPeriod < 2){
			minPeriod = Math.floor(minPeriod - 1);
			maxPeriod = Math.ceil(maxPeriod + 1);
		}
		for(var i = minPeriod; i <= maxPeriod; i++){
			this.periods.push(i);
		}
	} else {
		this.periods = options.periods;
	}

	if(!options.input){
		var self = this;
		getLiveInput(function(err,input){
			if(err){
				console.error('getUserMedia error:',err);
			} else {
				self.input = input;
				self.start();
			}
		});
	} else {
		this.input = options.input;
	}

	if(options.destroy){
		this.destroyCallback = options.destroy;
	}
	if(options.output){
		this.output = options.output;
	}

	this.correlations = new Array(this.MAX_SAMPLES);
	this.update = this.update.bind(this);
	this.started = false;
	this.frequency = -1;

	if(options.start){
		this.start();
	}
}

PitchDetector.defaultCallback = function(frequency){
	console.log('Detected frequency:',frequency,this.getPeriod(),this.getNoteNumber(),this.getNoteString());
};

PitchDetector.prototype.start = function(){
	if(!this.analyser && this.input){
		this.analyser = this.context.createAnalyser();
		this.analyser.fftSize = this.buffer.length * 2;
		this.input.connect(this.analyser);
		if(this.output){
			this.analyser.connect(this.output);
		}
	}
	this.started = true; 
	requestAnimationFrame(this.update);
};

PitchDetector.prototype.update = function(){
	var value = -1;
	if(this.analyser) {
		this.analyser.getFloatTimeDomainData(this.buffer);
		value = this.autoCorrelate();
		if(value > -1){
			this.frequency = value;
			if(this.stopAfterDetection === true){
				this.started = false;
			}
		}
	}
	if(this.callback){
		this.callback(value,this);
	}
	if(this.started === true){
		requestAnimationFrame(this.update);
	}
	return value;
};

PitchDetector.prototype.stop = function(){
	this.started = false;
};

// Free op resources
// 
// Note: It's not tested if it actually frees up resources
PitchDetector.prototype.destroy = function(){
	this.stop();
	if(this.destroyCallback){
		this.destroyCallback();
	}
	if(this.input && this.input.stop){
		try {
			this.input.stop(0);
		} catch(e){}
	}
	if(this.input) this.input.disconnect();
	this.input = null;
	this.analyser = null;
	this.context = null;
	this.buffer = null;
	this.correlations = null;
};

/**
 * Sync methoc to retrieve latest pitch in various forms:
 */

PitchDetector.prototype.getFrequency = function(){
	return this.frequency;
};

PitchDetector.prototype.getNoteNumber = function(){
	return frequencyToNote(this.frequency);
};

PitchDetector.prototype.getNoteString = function(){
	return frequencyToString(this.frequency);
};

PitchDetector.prototype.getPeriod = function(){
	return this.period;
};

PitchDetector.prototype.getCorrelation = function(){
	return this.correlation || 0;
};


PitchDetector.prototype.getDetune = function(){
	return centsOffFromPitch(this.frequency,frequencyToNote(this.frequency));
};

/**
 * AutoCorrelate algorithm
 */
PitchDetector.prototype.autoCorrelate = function AutoCorrelate(){
	var best_offset = -1;
	var best_correlation = 0;
	var last_correlation = 1;
	var rms = 0;
	var i = 0;
	var j = 0;
	var found_correlation = false;
	var BUFFER_LENGTH = this.buffer.length;
	var PERIOD_LENGTH = this.periods.length;
	var MAX_SAMPLES = this.MAX_SAMPLES;

	// Check if there is enough signal
	for (i=0; i< BUFFER_LENGTH;i++) {
		rms += this.buffer[i]*this.buffer[i];
	}
	rms = Math.sqrt(rms/ BUFFER_LENGTH); 
	this.rms = rms;

	if (rms< this.minRms) // not enough signal
		return -1;


	/**
	 *  Test different periods (i.e. frequencies)
	 *  
	 *  Buffer: |----------------------------------------| (1024)
	 *  i:      |    					1      44.1 kHz
	 *  		||                      2      22.05 kHz
	 *  		|-|                     3      14.7 kHz
	 *  		|--|                    4      11 kHz
	 *          ...
	 *          |-------------------|   512    86hz
	 *
	 * 
	 *  frequency = sampleRate / period
	 *  period = sampleRate / frequency
	 *  
	 * 
	 */
	for (i=0; i < PERIOD_LENGTH; i++) {
		var period = this.periods[i];
		var correlation = 0;

		/**
		 *
		 * Calculate sum-of-differences
		 *  
		 *  Buffer: |-------------------|--------------------| (1024)
		 *  j:
		 *  		|---|                        0
		 *  		 |---|                       1
		 *  		  |---|                      2
		 *  		    ...
		 *  		                     |---|   512
		 *
		 *  sum-of-differences
		 */
		for (j=0; j < MAX_SAMPLES; j++) {
			correlation += Math.abs((this.buffer[j])-(this.buffer[j+period]));
		}

		// average-difference = sum-of-differences / MAX_SAMPLES 
		// correlation = 1 - average-difference
		correlation = 1 - (correlation/MAX_SAMPLES);

		this.correlations[period] = correlation; // store it, for the tweaking we need to do below.
		

		// early stop-condition if we have a strong signal
		if(i > 1 && correlation > best_correlation){
			best_correlation = correlation;
			best_period = period;
			if(correlation > this.minCorrelation){
				found_correlation = true;
			}
		} else if (found_correlation){
			// short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
			// (because auto-correlate also finds lower octaves, they have a period of 2 * best_period)
			// 
			// Now we need to tweak the period - by interpolating between the values to the left and right of the
			// best period, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
			// we need to do a curve fit on this.correlations[] around best_period in order to better determine precise
			// (anti-aliased) period.

			// we know best_period >=1, 
			// since found_correlation cannot go to true until the second pass (period=1), and 
			// we can't drop into this clause until the following pass (else if).
			var shift = (this.correlations[best_period+1] - this.correlations[best_period-1]) /this.correlations[best_period];  
			this.period = best_period;
			this.correlation = best_correlation;
			return this.sampleRate/(best_period+(8*shift));
		}
		last_correlation = correlation;
	}

	// worst-case scenario
	if (best_correlation > 0.01) {
		// console.log("f = " + this.sampleRate/best_period + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
		this.period = best_period;
		this.correlation = best_correlation;
		return this.sampleRate/best_period;
	}
	return -1;
};

// Export on Window or as CommonJS module
if(typeof module !== 'undefined') {
	module.exports = PitchDetector;
} else {
	window.PitchDetector = PitchDetector;
}
})();