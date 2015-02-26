
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

function VolumeDetector(options){

	// Options:
	this.options = {
		minRms: 0.01,
	};

	// Internal Variables
	this.context = options.context; // AudioContext
	this.buffer = new Float32Array( options.length || 1024 ); // buffer array
	this.update = this.update.bind(this); // update function (bound to this)
	this.started = false; // state flag (to cancel requestAnimationFrame)
	this.input = null;	  // Audio Input Node
	this.output = null;   // Audio Output Node

	// Stats:
	this.stats = {
		detected: true,
		time: 0.0,
		rms: 0.0,
	};
	
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

VolumeDetector.prototype.setOptions = function(options){
	var self = this;

	// Override options (if defined)
	['minRms','onDebug','onDetect','onDestroy'
	].forEach(function(option){
		if(typeof options[option] !== 'undefined') {
			self.options[option] = options[option];
		}
	});

	// Warn if you're setting Constructor-only options!
	['input','output','length','context'].forEach(function(option){
		if(typeof options[option] !== 'undefined'){
			console.warn('VolumeDetector: Cannot set option "'+option+'"" after construction!');
		}
	});

	// keep track of stats for visualization
	if(options.onDebug){
		this.debug = {
			detected: false,
			time: 0.0,
			rms: 0.0,
		};
	}

	// Autostart
	if(options.start){
		this.start();
	}
};

VolumeDetector.prototype.start = function(){
	// Wait until input is defined (when waiting for microphone)
	if(!this.analyser && this.input){
		this.analyser = this.context.createAnalyser();
		this.analyser.fftSize = this.buffer.length * 2;
		this.input.connect(this.analyser);
		if(this.output){
			this.analyser.connect(this.output);
		}
	}
	if(!this.started){
		this.started = true; 
		requestAnimationFrame(this.update);
	}
};

VolumeDetector.prototype.update = function(){
	if(this.analyser) {
		this.analyser.getFloatTimeDomainData(this.buffer);
		var detected = this.calcRms();
		if(detected){
			if(this.options.stopAfterDetection === true){
				this.started = false;
			}
			if(this.options.onDetect){
				this.options.onDetect(this.stats,this);
			}
		}
	}
	if(this.options.onDebug){
		this.options.onDebug(this.debug,this);
	}
	if(this.started === true){
		requestAnimationFrame(this.update);
	}
};

VolumeDetector.prototype.stop = function(){
	this.started = false;
};

// Free op resources
// 
// Note: It's not tested if it actually frees up resources
VolumeDetector.prototype.destroy = function(){
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
	this.input = null;
	this.analyser = null;
	this.context = null;
	this.buffer = null;
	this.correlations = null;
};

/**
 * Sync methoc to retrieve latest pitch in various forms:
 */

VolumeDetector.prototype.getRms = function(){
	return this.stats.rms;
};


/**
 * AutoCorrelate algorithm
 */
VolumeDetector.prototype.calcRms = function AutoCorrelate(){
	var rms = 0;
	var BUFFER_LENGTH = this.buffer.length;

	// Check if there is enough signal
	for (i=0; i< BUFFER_LENGTH;i++) {
		rms += this.buffer[i]*this.buffer[i];
	}
	rms = Math.sqrt(rms/ BUFFER_LENGTH); 

	if(this.debug){
		this.debug.detected = rms < this.options.minRms;
		this.debug.time = this.context.currentTime;
		this.debug.rms = rms;
	}

	// Abort if not enough signal
	if (rms < this.options.minRms) {
		return false;
	} else {
		this.stats.time = this.context.currentTime;
		this.stats.rms = rms;
		return true;
	}
};

// Export on Window or as CommonJS module
if(typeof module !== 'undefined') {
	module.exports = VolumeDetector;
} else {
	window.VolumeDetector = VolumeDetector;
}
})();