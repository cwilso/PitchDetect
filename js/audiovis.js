var LiveRenderer = {
  MARGIN: 100,
  STAVE_WIDTH: 400,
  STAVE_HEIGHT: 150,
  BAR_DURATION: 1000,

  init: function(canvas) {
    LiveRenderer.canvas = canvas;
    LiveRenderer.canvas.height = LiveRenderer.STAVE_HEIGHT + LiveRenderer.MARGIN * 2;
    LiveRenderer.canvas.width = window.innerWidth;
    LiveRenderer.renderer = new Vex.Flow.Renderer(LiveRenderer.canvas,
        Vex.Flow.Renderer.Backends.CANVAS);
    LiveRenderer.context = LiveRenderer.renderer.getContext();
    LiveRenderer.tempCanvas = document.createElement('canvas');

    LiveRenderer.bookmark = {
      x: LiveRenderer.MARGIN,
      y: LiveRenderer.MARGIN
    };

    LiveRenderer.lastBar = {
      beams: [],
      notes: [],
      stave: new Vex.Flow.Stave(
          LiveRenderer.bookmark.x,
          LiveRenderer.bookmark.y,
          LiveRenderer.STAVE_WIDTH)
    };
    LiveRenderer.lastBar.stave.addClef('treble').setContext(LiveRenderer.context).draw();
  },

  addSample: function(voice, noteCode, sampleDuration, silence) {
    var suffix = silence ? 'r' : '';

    while (sampleDuration > 0) {
      var barDuration = LiveRenderer.remainingDuration(LiveRenderer.lastBar.notes);

      if (barDuration === 0) {
        LiveRenderer.nextBar();
        barDuration = LiveRenderer.remainingDuration(LiveRenderer.lastBar.notes);
      }

      var clippedDuration = 0;
      if (sampleDuration > barDuration) {
        clippedDuration = sampleDuration - barDuration;
        sampleDuration = barDuration;
      }

      var notes = LiveRenderer.notesFromDuration(sampleDuration);
      for (var i = 0; i < notes.length; i++) {
        notes[i] = new Vex.Flow.StaveNote({
          keys: [noteCode],
          duration: notes[i] + suffix
        });
      }
      LiveRenderer.lastBar.notes = LiveRenderer.lastBar.notes.concat(notes);
      //if (notes.length > 1) {
      //  LiveRenderer.lastBar.beams.push(new Vex.Flow.Beam(notes));
      //}

      sampleDuration = clippedDuration;
    }
  },

  addSilence: function(voice, duration) {
    LiveRenderer.addSample(voice, 'b/4', duration, true);
  },

  nextBar: function() {
    LiveRenderer.renderBar(LiveRenderer.lastBar);
    LiveRenderer.lastBar = {
      beams: [],
      notes: [],
      stave: undefined
    };

    LiveRenderer.bookmark.x += LiveRenderer.STAVE_WIDTH;
    if (LiveRenderer.bookmark.x +
        LiveRenderer.STAVE_WIDTH +
        LiveRenderer.MARGIN > LiveRenderer.canvas.width) {
      LiveRenderer.tempCanvas.width = LiveRenderer.canvas.width;
      LiveRenderer.tempCanvas.height = LiveRenderer.canvas.height;
      LiveRenderer.tempCanvas.getContext('2d').drawImage(LiveRenderer.canvas, 0, 0);
      LiveRenderer.canvas.height += LiveRenderer.STAVE_HEIGHT;
      LiveRenderer.context.drawImage(LiveRenderer.tempCanvas, 0, 0);

      LiveRenderer.bookmark.y += LiveRenderer.STAVE_HEIGHT;
      LiveRenderer.bookmark.x = LiveRenderer.MARGIN;
      LiveRenderer.lastBar.stave = new Vex.Flow.Stave(
          LiveRenderer.bookmark.x,
          LiveRenderer.bookmark.y,
          LiveRenderer.STAVE_WIDTH);
      LiveRenderer.lastBar.stave.addClef('treble').setContext(LiveRenderer.context).draw();
    } else {
      LiveRenderer.lastBar.stave = new Vex.Flow.Stave(
          LiveRenderer.bookmark.x,
          LiveRenderer.bookmark.y,
          LiveRenderer.STAVE_WIDTH);
      LiveRenderer.lastBar.stave.setContext(LiveRenderer.context).draw();
    }
  },

  renderBar: function(bar) {
    Vex.Flow.Formatter.FormatAndDraw(LiveRenderer.context, bar.stave, bar.notes);
    bar.beams.forEach(function(beam) {
      beam.setContext(LiveRenderer.context).draw();
    });
  },

  notesFromDuration: function(duration) {
    if (duration < LiveRenderer.BAR_DURATION / 16) {
      return [];
    } else if (duration < LiveRenderer.BAR_DURATION / 8) {
      return LiveRenderer.notesFromDuration(duration - LiveRenderer.BAR_DURATION / 16).concat([['16']]);
    } else if (duration < LiveRenderer.BAR_DURATION / 4) {
      return LiveRenderer.notesFromDuration(duration - LiveRenderer.BAR_DURATION / 8).concat([['8']]);
    } else if (duration < LiveRenderer.BAR_DURATION / 2) {
      return LiveRenderer.notesFromDuration(duration - LiveRenderer.BAR_DURATION / 4).concat([['4']]);
    } else if (duration < LiveRenderer.BAR_DURATION) {
      return LiveRenderer.notesFromDuration(duration - LiveRenderer.BAR_DURATION / 2).concat([['2']]);
    } else {
      return [['1']];
    }
  },

  // duration in sixteenths
  durationFromNoteType: function(noteType) {
    switch (noteType) {
      case '16':
      case '16r':
        return 1;
      case '8':
      case '8r':
        return 2;
      case '4':
      case '4r':
        return 4;
      case '2':
      case '2r':
        return 8;
      default:
        return 16;
    }
  },

  // returns true or the ms remaining in the bar
  remainingDuration: function(bar) {
    var sixteenths = 0;
    bar.forEach(function(note) {
      sixteenths += LiveRenderer.durationFromNoteType(note.duration);
    });
    if (sixteenths < 16) {
      return (16 - sixteenths) * LiveRenderer.BAR_DURATION / 16;
    } else {
      return 0;
    }
  }
};
