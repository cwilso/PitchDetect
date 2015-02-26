
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

function getLiveInput(context,callback){
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
	        	var liveInputNode = context.createMediaStreamSource(stream);
	        	callback(null,liveInputNode);
	        }, function(error){
   				console.error('getUserMedia error',error);
	        	callback(error,null);
	        });
   	} catch(e) {
   		console.error('getUserMedia exception',e);
        callback(e,null);
   	}
}

// prefix fixes
var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

function PitchDetector(options){

	// Options:
	this.options = {
		minRms: 0.01,
		interpolateFrequency: true,
		stopAfterDetection: false,
		normalize: false,
		minCorrelation: false,
		length: options.length,
		minCorrelationIncrease: false
	};

	// Internal Variables
	this.context = options.context; // AudioContext
	this.sampleRate = this.context.sampleRate; // sampleRate
	//this.buffer = new Float32Array( options.length || 1024 ); // buffer array
	this.MAX_SAMPLES = Math.floor(options.length/2); // MAX_SAMPLES number
	this.correlations = new Array(this.MAX_SAMPLES); // correlation array
	this.update = this.update.bind(this); // update function (bound to this)
	this.started = false; // state flag (to cancel requestAnimationFrame)
	this.input = null;	  // Audio Input Node
	this.output = null;   // Audio Output Node

	// Stats:
	this.stats = {
		detected: false,
		frequency: -1,
		best_period: 0,
		worst_period: 0,
		best_correlation: 0.0,
		worst_correlation: 0.0,
		time: 0.0,
		rms: 0.0,
	};

	this.lastOnDetect = 0.0;
	
	// Set input
	if(!options.input){
		var self = this;
		getLiveInput(this.context,function(err,input){
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

	// Set output
	if(options.output){
		this.output = options.output;
	}

	// Set options
	options.input = undefined;  	// 'input' option only allowed in constructor
	options.output = undefined; 	// 'output' option only allowed in constructor
	options.context = undefined;	// 'context' option only allowed in constructor
	options.length = undefined;		// 'length' option only allowed in constructor
	this.setOptions(options);
}

PitchDetector.prototype.setOptions = function(options,ignoreConstructorOnlyProperties){
	var self = this;

	// Override options (if defined)
	['minCorrelation','minCorrelationIncrease','minRms',
		'normalize','stopAfterDetection','interpolateFrequency',
		'onDebug','onDetect','onDestroy'
	].forEach(function(option){
		if(typeof options[option] !== 'undefined') {
			self.options[option] = options[option];
		}
	});

	if(ignoreConstructorOnlyProperties !== true){
		// Warn if you're setting Constructor-only options!
		['input','output','length','context'].forEach(function(option){
			if(typeof options[option] !== 'undefined'){
				console.warn('PitchDetector: Cannot set option "'+option+'"" after construction!');
			}
		});
	}

	// Set frequency domain (i.e. min-max period to detect frequencies on)
	var minPeriod = options.minPeriod || this.options.minPeriod || 2;
	var maxPeriod = options.maxPeriod || this.options.maxPeriod || this.MAX_SAMPLES;
	if(options.note){
		var period = Math.round(noteToPeriod(options.note,this.sampleRate));
		minPeriod = period;
		maxPeriod = period;
	}
	if(options.minNote){
		maxPeriod = Math.round(noteToPeriod(options.minNote,this.sampleRate));	
	}
	if(options.maxNote){
		minPeriod = Math.round(noteToPeriod(options.maxNote,this.sampleRate));	
	}
	if(options.minFrequency) {
		maxPeriod = Math.floor(this.sampleRate / options.minFrequency);
	}
	if(options.maxFrequency) {
		minPeriod = Math.ceil(this.sampleRate / options.maxFrequency);
	}
	if(options.periods){
		this.periods = options.periods;
	} else {
		this.periods = [];
		if(maxPeriod < minPeriod) {
			var tmp = maxPeriod;
			maxPeriod = minPeriod;
			minPeriod = tmp;
		}
		var range = [1,1];
		if(this.options.minCorrelation){
			range = [1,1];
		} else if(this.options.minCorrelationIncrease){
			range = [10,1];
		}
		if(maxPeriod - minPeriod < 1 + range[0] + range[1]){
			minPeriod = Math.floor(minPeriod - range[0]);
			maxPeriod = Math.ceil(maxPeriod + range[1]);
		}
		maxPeriod = Math.min(maxPeriod,this.MAX_SAMPLES);
		minPeriod = Math.max(2,minPeriod);
		this.options.minPeriod = minPeriod;
		this.options.maxPeriod = maxPeriod;
		for(var i = minPeriod; i <= maxPeriod; i++){
			this.periods.push(i);
		}
	}

	// keep track of stats for visualization
	if(options.onDebug){
		this.debug = {
			detected: false,
			frequency: -1,
			best_period: 0,
			worst_period: 0,
			best_correlation: 0.0,
			worst_correlation: 0.0,
			time: 0.0,
			rms: 0.0,
		};
	}

	// Autostart
	if(options.start){
		this.start();
	}
};

PitchDetector.prototype.start = function(){
	// Wait until input is defined (when waiting for microphone)
	if(!this.analyser && this.input){
		//this.analyser = this.context.createAnalyser();
		//this.analyser.fftSize = this.buffer.length * 2;
		
		this.analyser = this.context.createScriptProcessor(this.options.length);
		this.analyser.onaudioprocess = this.autoCorrelate.bind(this);
		this.input.connect(this.analyser);
		if(this.output){
			this.analyser.connect(this.output);
		} else {
			// webkit but, it requires an output....
			// var dummyOutput = this.context.createGain();
			// dummyOutput.gain.value= 0;
			// dummyOutput.connect(this.context.destination);
			var dummyOutput = this.context.createAnalyser();
			dummyOutput.fftSize = 32;
			this.analyser.connect(dummyOutput);
		}
	}
	if(!this.started){
		this.started = true; 
		requestAnimationFrame(this.update);
	}
};
PitchDetector.prototype.update = function(event){
	if(this.lastOnDetect !== this.stats.time){
		this.lastOnDetect = this.stats.time;
		if(this.options.onDetect){
			this.options.onDetect(this.stats,this);
		}
	}
	if(this.options.onDebug){
		this.options.onDebug(this.debug,this);
	}
	if(this.started === true){
		requestAnimationFrame(this.update);
	}
};

PitchDetector.prototype.stop = function(){
	this.started = false;
};

// Free op resources
// 
// Note: It's not tested if it actually frees up resources
PitchDetector.prototype.destroy = function(){
	this.stop();
	if(this.options.onDestroy){
		this.options.onDestroy();
	}
	if(this.input && this.input.stop){
		try {
			this.input.stop(0);
		} catch(e){}
	}
	if(this.input) this.input.disconnect();
	if(this.analyser) this.analyser.disconnect();
	this.input = null;
	this.analyser = null;
	this.context = null;
	this.buffer = null;
};

/**
 * Sync methoc to retrieve latest pitch in various forms:
 */

PitchDetector.prototype.getFrequency = function(){
	return this.stats.frequency;
};

PitchDetector.prototype.getNoteNumber = function(){
	return frequencyToNote(this.stats.frequency);
};

PitchDetector.prototype.getNoteString = function(){
	return frequencyToString(this.stats.frequency);
};

PitchDetector.prototype.getPeriod = function(){
	return this.stats.best_period;
};

PitchDetector.prototype.getCorrelation = function(){
	return this.stats.best_correlation;
};

PitchDetector.prototype.getCorrelationIncrease = function(){
	return this.stats.best_correlation - this.stats.worst_correlation;
};

PitchDetector.prototype.getDetune = function(){
	return centsOffFromPitch(this.stats.frequency,frequencyToNote(this.stats.frequency));
};

/**
 * AutoCorrelate algorithm
 */
PitchDetector.prototype.autoCorrelate = function AutoCorrelate(event){
	if(!this.started) return;

	// Keep track of best period/correlation
	var best_period = 0;
	var best_correlation = 0;

	// Keep track of local minima (i.e. nearby low correlation)
	var worst_period = 0;	
	var worst_correlation = 1;

	// Remember previous correlation to determine if
	// we're ascending (i.e. getting near a frequency in the signal)
	// or descending (i.e. moving away from a frequency in the signal)
	var last_correlation = 1;

	// iterators
	var i = 0; // for the different periods we're checking
	var j = 0; // for the different "windows" we're checking
	var period = 0; // current period we're checking.

	// calculated stuff
	var rms = 0;
	var correlation = 0;
	var peak = 0;

	// early stop algorithm
	var found_pitch = !this.options.minCorrelationIncrease && !this.options.minCorrelation;
	var find_local_maximum = this.options.minCorrelationIncrease;

	// Constants
	this.buffer = event.inputBuffer.getChannelData(0);
	var NORMALIZE = 1;
	var BUFFER_LENGTH = this.buffer.length;
	var PERIOD_LENGTH = this.periods.length;
	var MAX_SAMPLES = this.MAX_SAMPLES;


	// Check if there is enough signal
	for (i=0; i< BUFFER_LENGTH;i++) {
		rms += this.buffer[i]*this.buffer[i];
		// determine peak volume
		if(this.buffer[i] > peak) peak = this.buffer[i];
	}
	rms = Math.sqrt(rms/ BUFFER_LENGTH); 

	// Abort if not enough signal
	if (rms< this.options.minRms) {
		return false;
	}

	// Normalize (if configured)
	if(this.options.normalize === 'rms') {
		NORMALIZE = 2*rms;
	} else if(this.options.normalize === 'peak') {
		NORMALIZE = peak;
	}

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
		period = this.periods[i];
		correlation = 0;

		/**
		 *
		 * Sum all differences
		 *
		 * Version 1: Use absolute difference
		 * Version 2: Use squared difference.
		 *
		 * Version 2 exagerates differences, which is a good property.
		 * So we'll use version 2.
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
			// Version 1: Absolute values
			correlation += Math.abs((this.buffer[j])-(this.buffer[j+period])) / NORMALIZE;
			
			// Version 2: Squared values (exagarates difference, works better)
			//correlation += Math.pow((this.buffer[j]-this.buffer[j+period]) / NORMALIZE,2);
		}

		// Version 1: Absolute values
		correlation = 1 - (correlation/MAX_SAMPLES);
		
		// Version 2: Squared values
		//correlation = 1 - Math.sqrt(correlation/MAX_SAMPLES);

		// Save Correlation
		this.correlations[period] = correlation; 

		// We're descending (i.e. moving towards frequencies that are NOT in here)
		if(last_correlation > correlation){
 	       
 	       // We already found a good correlation, so early stop!
 	       if(this.options.minCorrelation && best_correlation > this.options.minCorrelation) {
 	       		found_pitch = true;
 	       		break;
 	       }

 	       // We already found a good correlationIncrease, so early stop!
 	       if(this.options.minCorrelationIncrease && best_correlation - worst_correlation > this.options.minCorrelationIncrease){
 	       		found_pitch = true;
				break;
 	       }

 	       // Save the worst correlation of the latest descend (local minima)
 	       worst_correlation = correlation;
 	       worst_period = period;

 	    // we're ascending, and found a new high!
		} else if(find_local_maximum || correlation > best_correlation){
			best_correlation = correlation;
			best_period = period;
		}

		last_correlation = correlation;
	}

	if(this.options.onDebug){
		this.debug.detected = false;
		this.debug.rms = rms;
		this.debug.time = this.context.currentTime;
		this.debug.best_period = best_period;
		this.debug.worst_period = worst_period;
		this.debug.best_correlation = best_correlation;
		this.debug.worst_correlation = worst_correlation;
		this.debug.frequency = best_period > 0? this.sampleRate/best_period: 0;
	}

	if (best_correlation > 0.01 && found_pitch) {
		this.stats.detected = true;
		this.stats.best_period = best_period;
		this.stats.worst_period = worst_period;
		this.stats.best_correlation = best_correlation;
		this.stats.worst_correlation = worst_correlation;
		this.stats.time = this.context.currentTime;
		this.stats.rms = rms;

		var shift = 0;
		if(this.options.interpolateFrequency && i >= 3 && period >= best_period + 1 && this.correlations[best_period+1] && this.correlations[best_period-1]){
			// Now we need to tweak the period - by interpolating between the values to the left and right of the
			// best period, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
			// we need to do a curve fit on this.correlations[] around best_period in order to better determine precise
			// (anti-aliased) period.

			// we know best_period >=1, 
			// since found_pitch cannot go to true until the second pass (period=1), and 
			// we can't drop into this clause until the following pass (else if).
			shift = (this.correlations[best_period+1] - this.correlations[best_period-1]) / best_correlation;  
			shift = shift * 8;
		}
		this.stats.frequency = this.sampleRate/(best_period + shift);

		if(this.options.onDebug){
			this.debug.detected = true;
			this.debug.frequency = this.stats.frequency;
		}
		if(this.options.stopAfterDetection){
			this.started = false;
		}
		return true;
	} else {		
		return false;
	}
};

// Export on Window or as CommonJS module
if(typeof module !== 'undefined') {
	module.exports = PitchDetector;
} else {
	window.PitchDetector = PitchDetector;
}
})();