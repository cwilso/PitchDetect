# Pitch Detector

> I whipped this app up to start experimenting with pitch detection, and also to test live audio input.  It used to perform a naive (zero-crossing based) pitch detection algorithm; now it uses a naively-implemented auto-correlation algorithm in realtime, so it should work well with most monophonic waveforms (although strong harmonics will throw it off a bit).  It works well with whistling (which has a clear, simple waveform); it also works pretty well to tune my guitar.
> 
> Live instance hosted on https://webaudiodemos.appspot.com/pitchdetect/.
> 
> Check it out, feel free to fork, submit pull requests, etc.  MIT-Licensed - party on.
> 
> -Chris

I've extracted the core logic into a standalone module.

The GUI is now seperate (see `/example/gui.js`). I've also enhanced the display to visualize the detection algorithm.

See demo at http://lab.madebymark.nl/pitch-detector/example/.

- Mark

## Usage

Drop `pitchdetector.js` in your page, or use CommonJS modules (i.e. browserify, webpack) to require the file.

First, create a PitchDetector:
```javascript
var detector = new PitchDetector({
	// Audio Context (Required)
	context: new AudioContext(),

	// Input AudioNode (Required)
	input: audioBufferNode, // default: Microphone input

	// Output AudioNode (Optional)
	output: AudioNode, // default: no output

	// Callback on pitch detection (Optional)
	// You can also query the results using public methods.
	onDetect: function(stats, pitchDetector) { 
		stats.frequency
		stats.detected
		stats.worst_correlation // worst correlation BEFORE the best correlation (local minimum, not global minimum!)
		stats.best_correlation 
		stats.worst_period
		stats.best_period
		stats.time // audioContext currentTime of detection
		stats.rms
	},

	// Debug Callback for visualisation
	onDebug: function(stats, pitchDetector) { },

	// Minimal signal strength (RMS, Optional)
	minRms: 0.01,

	// Detect pitch only with minimal correlation of:
	minCorrelation: 0.9,

	// Detect pitch only if correlation increases with at least:
	minCorreationIncrease: 0.5,

	// Note: you cannot use minCorrelation and minCorreationIncrease
	// at the same time!

	// Signal Normalization
	normalize: "rms" // or "peak". default: undefined

	// Only detect pitch once:
	stopAfterDetection: false

	// Buffer length
	length: 1024,

	// Limit frequency range (Optional):
	minNote: 69, // MIDI note number
	maxNote: 80, 

	minFrequency: 440,    // Frequency in Hz
	maxFrequency: 20000,

	minPeriod: 2,  // Actual distance in audio buffer
	maxPeriod: 512 // --> convert to frequency: frequency = sampleRate / period

	// Start right away
	start: true // default: false
})
```

Then, start the pitch detection. It is tied to RequestAnimationFrame
```javascript
detector.start()
```

If you're done, you can stop or destroy the detector:
```javascript
detector.stop()
detector.destroy()
```

You can also query the latest detected pitch:
```javascript
detector.getFrequency() // --> 440hz
detector.getNoteNumber() // --> 69
detector.getNoteString() // --> "A4"
detector.getPeriod() // --> 100
detector.getDetune() // --> 0
detector.getCorrelation() // --> 0.95
detector.getCorrelationIncrease() // --> 0.95

// or raw data
detector.stats = {
	stats.frequency
	stats.detected
	stats.worst_correlation
	stats.best_correlation 
	stats.worst_period
	stats.best_period
	stats.rms
}
```

## Tips & Tricks

### Always use an optimization

* `minCorrelation` is the most reliable
* `minCorreationIncrease` can sometimes give better results.

### Use `RMS` or `Peak` normalization with `minCorrelationIncrease`

The increase in correlation strongly depends on signal volume. Therefore, normalizing using `RMS` or `Peak` can make `minCorrelationIncrease` work much better.

### Set a frequency range

If you know what you're looking or, set a frequency range. 

**Warning:** `minCorrelationIncrease` needs a bigger frequency range, because needs it detects target frequency when higher frequencies have a very **low correlation**! (Therefore the correlation increase from "bad frequency" to "target frequency" is high).