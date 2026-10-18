import { formatPerf, PerfMonitor } from "../perf";

describe("PerfMonitor", () => {
  it("fps médio e p5 de quadros regulares a 60 Hz", () => {
    const m = new PerfMonitor();
    for (let i = 0; i <= 600; i++) m.frame(i * (1000 / 60));
    const s = m.totalSnapshot();
    expect(s.frames).toBe(600);
    expect(s.fps_avg).toBeCloseTo(60, 0);
    expect(s.fps_p5).toBeGreaterThan(55);
    expect(s.frame_ms_p95).toBeCloseTo(17, 0);
    expect(s.long_frames).toBe(0);
  });

  it("travadas aparecem no p95, no máximo e em long_frames", () => {
    const m = new PerfMonitor();
    let t = 0;
    m.frame(t);
    for (let i = 0; i < 100; i++) {
      t += i % 10 === 0 ? 50 : 1000 / 60; // 10% dos quadros com 50 ms
      m.frame(t);
    }
    const s = m.totalSnapshot();
    expect(s.long_frames).toBe(10);
    expect(s.frame_ms_max).toBe(50);
    expect(s.frame_ms_p95).toBe(50);
    expect(s.fps_p5).toBe(20);
  });

  it("ignora pausas longas (segundo plano) e conta rollbacks pelo delta do contador", () => {
    const m = new PerfMonitor();
    m.frame(0);
    m.frame(16);
    m.frame(5000); // 5 s parado: não é quadro
    m.frame(5016);
    m.setRollbacks(40); // base da sessão
    m.setRollbacks(43);
    m.setRollbacks(43);
    m.sim(0.5);
    m.draw(3);
    const s = m.totalSnapshot();
    expect(s.frames).toBe(2);
    expect(s.rollbacks).toBe(3);
    expect(s.sim_ms_p95).toBe(0.5);
    expect(s.draw_ms_p95).toBe(3);
  });

  it("a janela do overlay reinicia a cada leitura; o total não", () => {
    const m = new PerfMonitor();
    for (let i = 0; i <= 30; i++) m.frame(i * 16);
    expect(m.windowSnapshot().frames).toBe(30);
    expect(m.windowSnapshot().frames).toBe(0);
    expect(m.totalSnapshot().frames).toBe(30);
    expect(formatPerf(m.totalSnapshot())).toMatch(/fps/);
  });
});
