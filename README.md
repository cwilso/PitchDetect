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
	callback: function(frequency, pitchDetector) { },

	// Minimal signal strength (RMS, Optional)
	minRms: 0.01,

	// Minimal Correlation for early detection (Optional)
	minCorrelation: 0.9,

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

You can also query the latest data:
```javascript
detector.getFrequency() // --> 440hz
detector.getNoteNumber() // --> 69
detector.getNoteString() // --> "A4"
detector.getPeriod() // --> 100
detector.getDetune() // --> 0
detector.getCorrelation() // --> 0.95
```

Note that the callback gives you a reference to the pitchDetector, so you can do:
```javascript
var callback = function(frequency,detector) {
	detector.getDetune();
	// etc
}
```
