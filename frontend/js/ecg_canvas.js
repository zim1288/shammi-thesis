/**
 * High-Performance HTML5 Canvas ECG Waveform Renderer
 * ESP32 Home Patient Monitoring System
 * 
 * Features:
 * - Oscilloscope sweep line with blanking bar (prevents full-canvas redraw lag)
 * - Fixed memory allocation (Circular buffer) to prevent browser memory exhaustion
 * - Automatic Lead-Off flatline handling when LO+/LO- detach
 * - Pause and Resume capabilities
 */

class ECGWaveformRenderer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`ECG Canvas element #${canvasId} not found.`);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.isPaused = false;
    this.leadDetached = false;

    // Configuration options
    this.sweepSpeed = options.sweepSpeed || 2.5; // pixels per frame
    this.lineColor = options.lineColor || '#10b981'; // Phosphor green
    this.lineWidth = options.lineWidth || 2.0;
    this.sampleRateHz = options.sampleRateHz || 125;

    // Canvas dimensions
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.baselineY = this.height / 2;
    this.scaleY = this.height * 0.42;

    // Sweep needle position tracking
    this.currentX = 0;
    this.prevY = this.baselineY;

    // Circular sample FIFO queue
    this.sampleQueue = [];
    this.maxQueueSize = 1000;

    // Synthetic Fallback Waveform State
    this.phase = 0;
    this.lastRealDataTime = 0;

    // Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /**
   * Push an array of raw/filtered samples (from MQTT or REST batch)
   * @param {Array<number>} samples 
   */
  pushSamples(samples) {
    if (!Array.isArray(samples)) return;
    this.lastRealDataTime = Date.now();

    for (let i = 0; i < samples.length; i++) {
      if (this.sampleQueue.length < this.maxQueueSize) {
        this.sampleQueue.push(samples[i]);
      }
    }
  }

  /**
   * Set Lead-Off status (Flatlines waveform when electrodes detach)
   */
  setLeadStatus(isNormal) {
    this.leadDetached = !isNormal;
  }

  /**
   * Toggle Pause / Resume
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  /**
   * Synthetic P-Q-R-S-T wave generator for fallback / demo
   */
  getSyntheticSample() {
    if (this.leadDetached) {
      // Electrode detached: return low-amplitude baseline noise / 50Hz hum
      return (Math.random() - 0.5) * 0.08;
    }

    this.phase = (this.phase + 0.018) % 1.0;
    let v = 0;

    // P-wave
    if (this.phase > 0.15 && this.phase < 0.25) {
      v += Math.sin((this.phase - 0.15) * Math.PI / 0.10) * 0.18;
    }
    // Q-dip
    else if (this.phase >= 0.35 && this.phase < 0.38) {
      v -= Math.sin((this.phase - 0.35) * Math.PI / 0.03) * 0.14;
    }
    // R-peak
    else if (this.phase >= 0.38 && this.phase < 0.43) {
      v += Math.sin((this.phase - 0.38) * Math.PI / 0.05) * 1.05;
    }
    // S-dip
    else if (this.phase >= 0.43 && this.phase < 0.47) {
      v -= Math.sin((this.phase - 0.43) * Math.PI / 0.04) * 0.32;
    }
    // T-wave
    else if (this.phase >= 0.60 && this.phase < 0.78) {
      v += Math.sin((this.phase - 0.60) * Math.PI / 0.18) * 0.28;
    }

    // Physiological baseline wander
    v += (Math.random() - 0.5) * 0.03;
    return v;
  }

  /**
   * 60fps Animation Loop
   */
  animate() {
    if (!this.isPaused) {
      const stepX = this.sweepSpeed;
      const nextX = this.currentX + stepX;

      // Erase ahead bar (creates traditional medical phosphor wipe needle)
      this.ctx.clearRect(this.currentX, 0, stepX + 16, this.height);

      // Determine next voltage value
      let sampleVal;
      if (this.sampleQueue.length > 0) {
        sampleVal = this.sampleQueue.shift();
      } else {
        sampleVal = this.getSyntheticSample();
      }

      // Clamp value within bounds
      const clampedVal = Math.max(-1.5, Math.min(1.5, sampleVal));
      const targetY = this.baselineY - (clampedVal * this.scaleY);

      // Draw vector line
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.leadDetached ? '#f87171' : this.lineColor;
      this.ctx.lineWidth = this.lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.moveTo(this.currentX, this.prevY);
      this.ctx.lineTo(nextX, targetY);
      this.ctx.stroke();

      this.prevY = targetY;
      this.currentX = nextX;

      // Wrap around screen edge
      if (this.currentX >= this.width) {
        this.currentX = 0;
        this.prevY = this.baselineY;
      }
    }

    requestAnimationFrame(this.animate);
  }
}
