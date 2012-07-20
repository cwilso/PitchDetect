var audioContext = new webkitAudioContext();
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;

window.onload = function() {
	var request = new XMLHttpRequest();
	request.open("GET", "../sounds/whistling.ogg", true);
	request.responseType = "arraybuffer";
	request.onload = function() {
	  audioContext.decodeAudioData( request.response, function(buffer) { 
	    	theBuffer = buffer;
		} );
	}
	request.send();
}

function togglePlayback() {
    var now = audioContext.currentTime;

    if (isPlaying) {
        //stop playing and return
        sourceNode.noteOff( now );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
        return "play";
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = theBuffer;
    sourceNode.loop = true;

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect( analyser );
    analyser.connect( audioContext.destination );
    sourceNode.noteOn( now );
    isPlaying = true;

    return "stop";
}

var rafID = null;
var tracks = null;
var buflen = 1024;
var buf = new Uint8Array( buflen );
var MINVAL = 134;  // 128 == zero.  MINVAL is the "minimum detected signal" level.

function findNextPositiveZeroCrossing( start ) {
	var i = start;
	var last_zero = -1;
	// advance until we're zero or negative
	while (i<buflen && (buf[i] > 128 ) )
		i++;
	if (i>=buflen)
		return -1;

	// advance until we're above MINVAL, keeping track of last zero.
	while (i<buflen && ((t=buf[i]) < MINVAL )) {
		if (t >= 128) {
			if (last_zero == -1)
				last_zero = i;
		} else
			last_zero = -1;
		i++;
	}

	// we may have jumped over MINVAL in one sample.
	if (last_zero == -1)
		last_zero = i;

	if (i==buflen)
		return -1;
	else
		return last_zero;
}

var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromPitch( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	var midiNote = Math.round( noteNum ) + 57;
	return  (noteStrings[midiNote%12] + " - bend " + (noteNum + 57 - midiNote)/midiNote );
}

function updatePitch( time ) {
	var cycles = new Array;
	analyser.getByteTimeDomainData( buf );

	var i=0;
	// find the first point
	var last_zero = findNextPositiveZeroCrossing( 0 );

	// keep finding points, adding cycle lengths to array
	while ( last_zero != -1) {
		var next_zero = findNextPositiveZeroCrossing( last_zero + 1 );
		if (next_zero > -1)
			cycles.push( next_zero - last_zero );
		last_zero = next_zero;
	}

	// 1?: average the array
	var num_cycles = cycles.length;
	var sum = 0;
	var pitch = 0;

	for (var i=0; i<num_cycles; i++) {
		sum += cycles[i];
	}

	if (num_cycles) {
		sum /= num_cycles;
		pitch = audioContext.sampleRate/sum;
	}

// confidence = num_cycles / num_possible_cycles = num_cycles / (audioContext.sampleRate/)
	console.log( 
		"Cycles: " + num_cycles + 
		" - average length: " + sum + 
		" - pitch: " + pitch + "Hz " +
		" - note: " + noteFromPitch( pitch ) +
		" - confidence: " + (num_cycles ? ((num_cycles/(pitch * buflen / audioContext.sampleRate)) * 100) : 0) + "% "
		);

	// 2?: sort the array, take the median; go through the array and compute the average deviation

//	rafID = window.webkitRequestAnimationFrame( updatePitch );
}
