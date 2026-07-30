export class DeviceStreamHealth {
  private sampleCount = 0;
  private dataGapCount = 0;
  private lastSampleAtMs: number | null = null;

  recordSample(nowMs: number, expectedIntervalMs = 1_000) {
    const gapThreshold = Math.max(3_000, expectedIntervalMs * 3);
    if (this.lastSampleAtMs !== null && nowMs - this.lastSampleAtMs > gapThreshold) {
      this.dataGapCount += 1;
    }
    this.sampleCount += 1;
    this.lastSampleAtMs = nowMs;
    return this.snapshot();
  }

  reset() {
    this.sampleCount = 0;
    this.dataGapCount = 0;
    this.lastSampleAtMs = null;
  }

  snapshot() {
    return {
      sampleCount: this.sampleCount,
      dataGapCount: this.dataGapCount,
      lastSampleAt: this.lastSampleAtMs === null ? null : new Date(this.lastSampleAtMs).toISOString(),
    };
  }
}
