# Pitch Detector

Based on Chris Wilson's work, an improved pitch detector. The Pitch Detector calculates auto-correlation score for a range of frequencies.

See demo at http://lab.madebymark.nl/pitch-detector/example/.

## Examples

The **Y-Axis** is the auto-correlation score. The **X-Axis** is the frequency range, from high (22 
Khz) to low (83 Hz).

Detect best auto-correlation of all frequencies:

![Auto-Correlation scores](example/example1.png)

Detect the first peak auto-correlation, which is the highest frequency. Auto-correlation also detects lower octaves (and harmonies) of a frequency. 

![Auto-Correlation scores, detect the first peak correlation](example/example2.png)

Detect a sudden increase in correlation: 

![Auto-Correlation scores, detect the first increase in correlation](example/example3.png)

## Usage

* `pitchdetector.js` contains the PitchDetector (logic only)
* `pitchdetectorcanvas.js` allows you to visualize pitch detection on a canvas.
* `example/gui.js` is a playground to test and tweak the pitch detector.

Drop `pitchdetector.js` in your page, or require the CommonJS module using Webpack or Browserify.

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

### Use RMS or Peak normalization with minCorrelationIncrease

The increase in correlation strongly depends on signal volume. Therefore, normalizing using `RMS` or `Peak` can make `minCorrelationIncrease` work much better.

### Set a frequency range

If you know what you're looking or, set a frequency range. 

**Warning:** `minCorrelationIncrease` needs a large frequency range to detect a difference. The frequency range must be large enough to include both a low and high auto-correlation.

## Changelog

### 0.2.0 (26/02/2015)

* Used ScriptProcessingNode for faster analysis. Callbacks are still tied to the requestAnimationFrame.
* Extracted the Canvas draw function into a seperate file.

### 0.1.0 (25/02/2015)

* Extract core logic (pitchdetector.js) from the GUI code (example/gui.js)
* Add a new heuristic: detect a sudden increase in auto-correlation (when approaching the target frequency).
* Added signal normalization (peak or rms)
* Updated canvas visualization to draw correlation scores for every frequency.

## Contribute

I first want to check if the original author, Chris Wilson, is willing to pull my fork. So please check out the original version at https://github.com/cwilso/PitchDetect.

## Credits

Original code from [Chris Wilson](https://github.com/cwilso), improvements (see changelog) by [Mark Marijnissen](https://github.com/markmarijnissen)

## Contact
-   @markmarijnissen
-   http://www.madebymark.nl
-   info@madebymark.nl

© 2015 - Mark Marijnissen
