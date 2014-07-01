# Simple pitch detection

I whipped this app up to start experimenting with pitch detection, and also to test live audio input.  It used to perform a naive (zero-crossing based) pitch detection algorithm; now it uses a naively-implemented auto-correlation algorithm in realtime, so it should work well with most monophonic waveforms (although strong harmonics will throw it off a bit).  It works well with whistling (which has a clear, simple waveform); it also works pretty well to tune my guitar.

Live instance hosted on https://webaudiodemos.appspot.com/pitchdetect/.

Check it out, feel free to fork, submit pull requests, etc.  MIT-Licensed - party on.

-Chris
