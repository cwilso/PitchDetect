(function(){
	var PitchDetectorCanvasDraw = function PitchDetectorCanvasDraw(canvas,stats,pitchDetector){
		if(!pitchDetector || !pitchDetector.buffer) return;
		var buf = pitchDetector.buffer;
		var i = 0, val = 0, len = 0, start = 20, end = 50;
		if(pitchDetector.periods){
			start = pitchDetector.periods[0] + 20;
			end = pitchDetector.periods[pitchDetector.periods.length-1] + 20;
		}
		var width = end-start;
		
		canvas.clearRect(0,0,512,256);
		canvas.fillStyle = "#EEFFEE";
		canvas.fillRect(start,0,width,256);

		// AREA: Draw Pitch Detection Area
		if(pitchDetector.options.minCorrelation){
			canvas.fillStyle = "yellow";
			canvas.fillRect(start,0,width,(1-pitchDetector.options.minCorrelation) * 256);
		} 

		// AREA: Draw Correlations
		if(pitchDetector.correlations){
			canvas.beginPath();
			canvas.strokeStyle = "black";
			if(pitchDetector.options.minCorrelation || pitchDetector.options.minCorrelationIncrease){
				len = Math.max(stats.worst_period,stats.best_period + 1);
			} else {
				len = pitchDetector.correlations.length;
			}
			for(i = 0; i<len; i++){
				val = pitchDetector.correlations[i] || 0;
				canvas.moveTo(i+20,256);
				canvas.lineTo(i+20,256 - (val * 256));
			}
			canvas.stroke();
		}

		// LINE: Draw Frequency Range
		canvas.strokeStyle = "green";
		canvas.beginPath();
		canvas.moveTo(start,0);
		canvas.lineTo(start,256);
		canvas.moveTo(end,0);
		canvas.lineTo(end,256);
		canvas.stroke();


		// AREA: Draw RMS 
		canvas.fillStyle = "red";
		val = 256 - stats.rms * 256;
		canvas.fillRect(0,val,10,256-val);

		// LINE: Draw Min RMS
		val = 256 - pitchDetector.options.minRms * 256;
		canvas.strokeStyle = "darkred";
		canvas.beginPath();
		canvas.moveTo(0,val);
		canvas.lineTo(10,val);
		canvas.stroke();

		// LINE: Draw Strength (i.e. increase in correlation)
		if(pitchDetector.options.minCorrelationIncrease){

		    // AREA increase measured
			canvas.fillStyle = "#EEEEFF";
			val = 256 - (stats.best_correlation - stats.worst_correlation) * 256;
			canvas.fillRect(10,val,10,256-val);

			// Line min increase
			canvas.strokeStyle = "blue";
			val = (1-pitchDetector.options.minCorrelationIncrease) * 256;
			canvas.beginPath();
			canvas.moveTo(10,val);
			canvas.lineTo(20,val);
			// line worst correlation
			val = 256 - 256 * stats.worst_correlation;
			canvas.moveTo(start,val);
			canvas.lineTo(20 + stats.best_period,val);
			// line best correlation
			val = 256 - 256 * stats.best_correlation;
			canvas.moveTo(start,val);
			canvas.lineTo(20 + stats.best_period,val);
			// line worst period
			val = 20 + stats.worst_period;
			canvas.moveTo(val,0);
			canvas.lineTo(val,256);


			canvas.stroke();
		    
		}
	};
	if(typeof module === 'undefined'){
		window.PitchDetectorCanvasDraw = PitchDetectorCanvasDraw;
	} else {
		module.exports = PitchDetectorCanvasDraw;
	}
})();