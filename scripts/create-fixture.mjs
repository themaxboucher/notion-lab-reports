import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const fixturePath = fileURLToPath(
  new URL("../fixtures/lab-report.json", import.meta.url),
);
const timestamp = Date.UTC(2026, 8, 28, 12);
const idFor = (name) => {
  const digest = createHash("sha256")
    .update(`notion-labs-fixture:${name}`)
    .digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
};
const pageId = idFor("root");
const spaceId = idFor("space");
const authorId = idFor("author");
const recordMap = {
  block: {},
  collection: {},
  collection_view: {},
  notion_user: {},
  collection_query: {},
  signed_urls: {},
};
const rich = (text) => [[String(text)]];

function add(name, type, text, extra = {}, parent = pageId) {
  const id = idFor(name);
  const value = {
    id,
    type,
    version: 1,
    created_time: timestamp,
    last_edited_time: timestamp,
    parent_id: parent,
    parent_table: type === "page" ? "space" : "block",
    alive: true,
    created_by_table: "notion_user",
    created_by_id: authorId,
    last_edited_by_table: "notion_user",
    last_edited_by_id: authorId,
    space_id: spaceId,
    ...(text === undefined
      ? {}
      : { properties: { title: Array.isArray(text) ? text : rich(text) } }),
    ...extra,
  };
  recordMap.block[id] = { role: "reader", value };
  if (type !== "page") {
    const parentValue = recordMap.block[parent]?.value;
    if (!parentValue) throw new Error(`Missing parent for ${name}`);
    parentValue.content ??= [];
    parentValue.content.push(id);
  }
  return id;
}

const chartData = async (svg) => {
  const png = await sharp(Buffer.from(svg), { density: 192 }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
};
const waveform = Array.from({ length: 161 }, (_, index) => {
  const x = 20 + index * 2;
  const y = 65 - 29 * Math.sin((index / 160) * 6 * Math.PI);
  return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");
const coverImage = await chartData(
  `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="130" viewBox="0 0 360 130"><rect width="360" height="130" fill="white"/><path d="M20 65H340" stroke="#d4d4d4"/><path d="${waveform}" fill="none" stroke="#334155" stroke-width="2.3"/><text x="180" y="117" text-anchor="middle" font-family="sans-serif" font-size="11" letter-spacing="3" fill="#737373">SIGNALS &amp; SYSTEMS</text></svg>`,
);

const cutoff = 1 / (2 * Math.PI * 1000 * 100e-9);
const measurements = Array.from({ length: 60 }, (_, index) => {
  const frequency = 100 * 100 ** (index / 59);
  const theoretical = 1 / Math.sqrt(1 + (frequency / cutoff) ** 2);
  const measured = theoretical * (1 + 0.008 * Math.sin(index * 0.73) - 0.004);
  return {
    sample: index + 1,
    frequency,
    theoretical,
    measured,
    phase:
      (-Math.atan(frequency / cutoff) * 180) / Math.PI +
      0.35 * Math.cos(index * 0.47),
  };
});
const xFor = (frequency) => 70 + 610 * (Math.log10(frequency / 100) / 2);
const yFor = (gain) => 50 - 11 * (20 * Math.log10(gain));
const curve = measurements
  .map(
    (row, index) =>
      `${index ? "L" : "M"}${xFor(row.frequency).toFixed(2)},${yFor(row.theoretical).toFixed(2)}`,
  )
  .join(" ");
const dots = measurements
  .filter((_, index) => index % 3 === 0)
  .map(
    (row) =>
      `<circle cx="${xFor(row.frequency).toFixed(2)}" cy="${yFor(row.measured).toFixed(2)}" r="3" fill="white" stroke="#9a6544" stroke-width="1.5"/>`,
  )
  .join("");
const grid = [0, -5, -10, -15]
  .map(
    (gain) =>
      `<path d="M70 ${50 - 11 * gain}H680" stroke="#e5e7eb"/><text x="56" y="${54 - 11 * gain}" text-anchor="end" font-family="sans-serif" font-size="12" fill="#525252">${gain}</text>`,
  )
  .join("");
const resultsImage = await chartData(
  `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="300" viewBox="0 0 750 300"><rect width="750" height="300" fill="white"/>${grid}<path d="M70 40V245H680" fill="none" stroke="#a3a3a3"/><path d="${curve}" fill="none" stroke="#334155" stroke-width="2"/>${dots}<path d="M${xFor(cutoff).toFixed(2)} 40V245" stroke="#94a3b8" stroke-dasharray="4 4"/><text x="${xFor(cutoff) + 8}" y="226" font-family="sans-serif" font-size="11" fill="#525252">f_c = 1.59 kHz</text><g font-family="sans-serif" font-size="12" fill="#525252"><text x="70" y="266" text-anchor="middle">100</text><text x="375" y="266" text-anchor="middle">1,000</text><text x="680" y="266" text-anchor="middle">10,000</text><text x="375" y="290" text-anchor="middle">Frequency (Hz, logarithmic scale)</text><text x="18" y="150" transform="rotate(-90 18 150)" text-anchor="middle">Gain (dB)</text><path d="M450 20H474" stroke="#334155" stroke-width="2"/><text x="482" y="24">Model</text><circle cx="567" cy="20" r="3" fill="white" stroke="#9a6544" stroke-width="1.5"/><text x="579" y="24">Measured</text></g></svg>`,
);

add(
  "root",
  "page",
  "ENSF 462 — Lab 3: Frequency Response",
  {
    content: [],
    format: { page_icon: "🔬", page_full_width: false, page_small_text: false },
    permissions: [{ role: "reader", type: "public_permission" }],
  },
  spaceId,
);

add("cover-course", "sub_header", "ENSF 462 · Laboratory 03");
add(
  "cover-title",
  "header",
  "Frequency Response of a\nFirst-Order Low-Pass Filter",
);
add(
  "cover-description",
  "text",
  "A comparison of the analytical model, measured gain, and phase response",
);
add("cover-image", "image", undefined, {
  properties: {
    source: rich(coverImage),
    caption: rich(
      "A sinusoidal input reveals a circuit’s response across frequency.",
    ),
    alt_text: rich("A simple sinusoidal signal on a horizontal axis"),
  },
  format: {
    display_source: coverImage,
    block_width: 360,
    block_height: 130,
    block_alignment: "center",
    block_aspect_ratio: 130 / 360,
  },
});
add("cover-authors", "bulleted_list", "Prepared by Alex Chen and Morgan Patel");
add("cover-section", "bulleted_list", "Section B02 · Bench 07");
add("cover-date", "text", "September 28, 2026");
add("cover-footer", "text", [
  ["Teaching fixture", [["i"]]],
  [" · Synthetic measurements for document rendering checks"],
]);
add("divider-cover", "divider");

add("intro-title", "header", "1. Objective and Method");
add(
  "intro",
  "text",
  "This experiment characterizes a passive RC low-pass filter from 100 Hz to 10 kHz. We compare the measured amplitude ratio and phase lag with a first-order model, then identify practical sources of disagreement near the cutoff frequency.",
);
add("formatting", "text", [
  ["The "],
  ["primary objective", [["b"]]],
  [" is to estimate the "],
  ["cutoff frequency", [["i"]]],
  [" with "],
  ["consistent probe settings", [["_"]]],
  [". The "],
  ["initial 2 V setting", [["s"]]],
  [" was revised to "],
  ["1.0 V peak-to-peak", [["b"], ["h", "blue"]]],
  [". Each run records "],
  ["Vout / Vin", [["c"]]],
  [" and compares it with "],
  ["‣", [["e", "|H(j\\omega)|"]]],
  [". "],
  ["Accepted measurements", [["h", "teal"]]],
  [" use the "],
  ["same ground reference", [["h", "yellow_background"]]],
  ["; the analysis follows the "],
  [
    "SciPy signal-processing reference",
    [["a", "https://docs.scipy.org/doc/scipy/reference/signal.html"]],
  ],
  ["."],
]);
add("model-title", "sub_header", "1.1 Analytical model");
add(
  "model-text",
  "text",
  "The resistor and capacitor form a voltage divider whose impedance changes with frequency. At the cutoff, the output magnitude is approximately 0.707 of the input and the phase lag is 45°.",
);
add(
  "model-equation",
  "equation",
  "H(j\\omega)=\\frac{1}{1+j\\omega RC},\\qquad f_c=\\frac{1}{2\\pi RC}\\approx 1.59\\,\\mathrm{kHz}",
);
add(
  "model-callout",
  "callout",
  "Reference values: R = 1.00 kΩ and C = 100 nF. The nominal time constant is 100 μs; resistor and capacitor tolerance were not fitted away.",
  { format: { page_icon: "ℹ️", block_color: "blue_background" } },
);

add("setup-title", "sub_header", "1.2 Experimental setup");
const columns = add("setup-columns", "column_list");
const equipment = add(
  "equipment-column",
  "column",
  undefined,
  { format: { column_ratio: 0.5 } },
  columns,
);
add("equipment-heading", "sub_sub_header", "Equipment", {}, equipment);
add(
  "equipment-1",
  "bulleted_list",
  "Function generator, sine-wave output",
  {},
  equipment,
);
add(
  "equipment-2",
  "bulleted_list",
  "Two-channel digital oscilloscope",
  {},
  equipment,
);
add(
  "equipment-3",
  "bulleted_list",
  "Breadboard, 1 kΩ resistor, 100 nF capacitor",
  {},
  equipment,
);
const conditions = add(
  "conditions-column",
  "column",
  undefined,
  { format: { column_ratio: 0.5 } },
  columns,
);
add(
  "conditions-heading",
  "sub_sub_header",
  "Acquisition conditions",
  {},
  conditions,
);
add(
  "conditions-1",
  "bulleted_list",
  "Input amplitude: 1.0 V peak-to-peak",
  {},
  conditions,
);
add(
  "conditions-2",
  "bulleted_list",
  "Sample rate: 48 kHz; 1 s capture",
  {},
  conditions,
);
add(
  "conditions-3",
  "bulleted_list",
  "60 logarithmically spaced frequencies",
  {},
  conditions,
);

const calibration = add(
  "calibration-toggle-heading",
  "sub_sub_header",
  "Calibration and probe checks",
  { format: { toggleable: true } },
);
add(
  "calibration-text",
  "text",
  "Both probes were set to ×10 and compensated before connection. A direct connection between generator output and both channels confirmed the amplitude ratio within 0.5% at 1 kHz.",
  {},
  calibration,
);
add(
  "calibration-check-1",
  "to_do",
  "Probe compensation checked on both channels",
  {
    properties: {
      title: rich("Probe compensation checked on both channels"),
      checked: [["Yes"]],
    },
  },
  calibration,
);
add(
  "calibration-check-2",
  "to_do",
  "Common ground verified before applying input",
  {
    properties: {
      title: rich("Common ground verified before applying input"),
      checked: [["Yes"]],
    },
  },
  calibration,
);
add(
  "calibration-check-3",
  "to_do",
  "Repeat sweep after replacing the capacitor",
  {
    properties: {
      title: rich("Repeat sweep after replacing the capacitor"),
      checked: [["No"]],
    },
  },
  calibration,
);

add("procedure-title", "sub_header", "1.3 Procedure");
const stepOne = add(
  "procedure-1",
  "numbered_list",
  "Assemble the RC network with the output measured across the capacitor.",
);
add(
  "procedure-1-a",
  "bulleted_list",
  "Keep the ground connection short to reduce pickup.",
  {},
  stepOne,
);
const stepOneB = add(
  "procedure-1-b",
  "bulleted_list",
  "Verify the circuit before recording data.",
  {},
  stepOne,
);
add(
  "procedure-1-b-1",
  "numbered_list",
  "Confirm resistor and capacitor labels.",
  {},
  stepOneB,
);
add(
  "procedure-1-b-2",
  "numbered_list",
  "Measure the input on channel 1 and output on channel 2.",
  {},
  stepOneB,
);
add(
  "procedure-2",
  "numbered_list",
  "Sweep 60 frequencies from 100 Hz to 10 kHz, allowing the output to settle at each point.",
);
const stepThree = add(
  "procedure-3",
  "numbered_list",
  "Record gain and phase, then compare the response with the theoretical curve.",
);
add(
  "procedure-3-a",
  "numbered_list",
  "Compute the amplitude ratio from the two peak-to-peak measurements.",
  {},
  stepThree,
);
add(
  "procedure-3-b",
  "numbered_list",
  "Convert the ratio to decibels using 20 log₁₀(gain).",
  {},
  stepThree,
);
add(
  "safety-callout",
  "callout",
  "Keep the generator output disabled while changing the circuit. A shared ground is essential for a meaningful phase measurement.",
  { format: { page_icon: "⚠️", block_color: "yellow_background" } },
);
add(
  "lab-quote",
  "quote",
  "A useful measurement records both the value and the conditions that make that value reproducible.",
);
const notes = add(
  "notes-toggle",
  "toggle",
  "Bench notes and quick calculation",
);
add(
  "notes-text",
  "text",
  "The 1 kHz spot check was completed before the full sweep. The following calculation gives a reference magnitude without rounding intermediate values.",
  {},
  notes,
);
add(
  "short-code",
  "code",
  undefined,
  {
    properties: {
      language: rich("Python"),
      title: rich(
        'from math import pi, sqrt\n\nresistance = 1_000.0  # ohms\ncapacitance = 100e-9  # farads\nfrequency = 1_000.0   # hertz\n\ncutoff = 1 / (2 * pi * resistance * capacitance)\ngain = 1 / sqrt(1 + (frequency / cutoff) ** 2)\nprint(f"Cutoff: {cutoff:.1f} Hz; gain at 1 kHz: {gain:.3f}")',
      ),
      caption: rich(
        "Listing 1. A short reference calculation, kept together on the printed page.",
      ),
    },
  },
  notes,
);
add("divider-results", "divider");

add("results-title", "header", "2. Results");
add(
  "results-summary",
  "text",
  "The response follows the expected low-pass trend: gain remains close to unity at low frequencies and rolls off as frequency increases. The synthetic measurements below include a small, smooth perturbation to exercise realistic numeric alignment and multi-page table layout.",
);
add("results-image", "image", undefined, {
  properties: {
    source: rich(resultsImage),
    caption: rich(
      "Figure 1. Measured and predicted amplitude response. Open markers show every third measurement; the dashed line marks the nominal cutoff.",
    ),
    alt_text: rich(
      "Gain versus logarithmic frequency, with measured points following a first-order low-pass response",
    ),
  },
  format: {
    display_source: resultsImage,
    block_width: 750,
    block_height: 300,
    block_alignment: "center",
    block_aspect_ratio: 0.4,
  },
});
add(
  "results-callout",
  "callout",
  "The largest relative amplitude deviation in this fixture is below 1.2%. These values illustrate report layout and are not a record of a physical experiment.",
  { format: { page_icon: "✓", block_color: "teal_background" } },
);
add("table-title", "sub_header", "2.1 Frequency sweep");
add(
  "table-description",
  "text",
  "Table 1 lists all 60 samples. Gain is dimensionless; phase is measured in degrees. The first row contains the column headings, and the sample identifier is a row heading.",
);
const table = add("measurement-table", "table", undefined, {
  format: {
    table_block_column_order: ["sample", "freq", "model", "measured", "phase"],
    table_block_column_header: true,
    table_block_row_header: true,
    table_block_column_format: {
      sample: { width: 65 },
      freq: { width: 130 },
      model: { width: 130 },
      measured: { width: 130 },
      phase: { width: 110 },
    },
  },
});
add(
  "measurement-table-header",
  "table_row",
  undefined,
  {
    properties: {
      sample: rich("Sample"),
      freq: rich("Frequency (Hz)"),
      model: rich("Model gain"),
      measured: rich("Measured gain"),
      phase: rich("Phase (°)"),
    },
  },
  table,
);
for (const row of measurements) {
  add(
    `measurement-${row.sample}`,
    "table_row",
    undefined,
    {
      properties: {
        sample: rich(String(row.sample).padStart(2, "0")),
        freq: rich(row.frequency.toFixed(1)),
        model: rich(row.theoretical.toFixed(4)),
        measured: rich(row.measured.toFixed(4)),
        phase: rich(row.phase.toFixed(1)),
      },
    },
    table,
  );
}
add("table-note", "text", [
  ["Table 1. ", [["b"]]],
  [
    "Frequency sweep values. Uncertainty from probe calibration is not included in these illustrative data.",
  ],
]);
add("divider-discussion", "divider");

add("discussion-title", "header", "3. Discussion and Conclusion");
add(
  "discussion-text",
  "text",
  "The model explains the dominant trend across two decades of frequency. Close agreement in amplitude does not remove the need to inspect phase: a wiring or channel-reference error can preserve the amplitude ratio while changing the apparent phase lag.",
);
const uncertainty = add(
  "uncertainty-toggle-heading",
  "sub_header",
  "3.1 Sources of uncertainty",
  { format: { toggleable: true } },
);
add(
  "uncertainty-1",
  "bulleted_list",
  "Component tolerance shifts the cutoff because the time constant depends on the product RC.",
  {},
  uncertainty,
);
add(
  "uncertainty-2",
  "bulleted_list",
  "Probe loading and long leads become more visible toward the upper end of the frequency range.",
  {},
  uncertainty,
);
add(
  "uncertainty-3",
  "bulleted_list",
  "Phase estimates are sensitive to trigger stability and the choice of reference channel.",
  {},
  uncertainty,
);
add(
  "uncertainty-callout",
  "callout",
  "A useful follow-up is to measure R and C independently, then redraw the predicted response using those measured component values.",
  { format: { page_icon: "💡", block_color: "purple_background" } },
);
add("conclusion-title", "sub_header", "3.2 Conclusion");
add(
  "conclusion-text",
  "text",
  "The observed response is consistent with a first-order low-pass filter having a nominal cutoff of 1.59 kHz. A complete experimental submission should report measured component values, instrument settings, and uncertainty alongside the final plots.",
);
add("references-title", "sub_header", "References and supporting material");
add("scipy-bookmark", "bookmark", undefined, {
  properties: {
    title: rich("SciPy signal processing reference"),
    link: rich("https://docs.scipy.org/doc/scipy/reference/signal.html"),
    description: rich(
      "Reference functions for frequency response, filtering, and spectral analysis.",
    ),
  },
  format: {},
});
add("numpy-link-preview", "external_object_instance", undefined, {
  properties: {
    title: rich("NumPy: discrete Fourier transform reference"),
    link: rich("https://numpy.org/doc/stable/reference/routines.fft.html"),
  },
  format: {
    domain: "numpy.org",
    original_url: "https://numpy.org/doc/stable/reference/routines.fft.html",
    title: "NumPy: discrete Fourier transform reference",
  },
});
add(
  "supporting-text",
  "text",
  "The original notebook may also contain interactive material. The following blocks deliberately exercise the report’s unsupported-content notices.",
);
add("unsupported-embed", "embed", undefined, {
  properties: {
    source: rich("https://www.example.com/interactive-filter-simulator"),
    caption: rich("Interactive circuit simulator"),
  },
  format: {
    display_source: "https://www.example.com/interactive-filter-simulator",
  },
});
add("unsupported-database", "collection_view", undefined, {
  collection_id: idFor("measurement-database"),
  view_ids: [idFor("measurement-database-view")],
  properties: { title: rich("Bench measurement database") },
  format: {},
});
add(
  "archive-callout",
  "callout",
  "The static report preserves the written method, figures, tables, and analysis code. Interactive supporting material remains available from its source link.",
  { format: { page_icon: "📎", block_color: "gray_background" } },
);
add("divider-appendix", "divider");

const appendix = add(
  "appendix-toggle-heading",
  "header",
  "Appendix A. Reproducible Analysis",
  { format: { toggleable: true } },
);
add(
  "appendix-intro",
  "text",
  "This self-contained Python listing recreates the synthetic sweep and writes a CSV summary. The long metadata line is intentional: a printed listing should wrap it without clipping, while the complete listing may continue onto another page.",
  {},
  appendix,
);
const analysisCode = `"""Generate the synthetic RC sweep used in the ENSF 462 lab fixture."""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Circuit:
    resistance_ohms: float = 1_000.0
    capacitance_farads: float = 100e-9

    @property
    def cutoff_hz(self) -> float:
        return 1.0 / (2.0 * math.pi * self.resistance_ohms * self.capacitance_farads)

    def magnitude(self, frequency_hz: float) -> float:
        ratio = frequency_hz / self.cutoff_hz
        return 1.0 / math.sqrt(1.0 + ratio * ratio)

    def phase_degrees(self, frequency_hz: float) -> float:
        return -math.degrees(math.atan(frequency_hz / self.cutoff_hz))


@dataclass(frozen=True)
class Measurement:
    sample: int
    frequency_hz: float
    model_gain: float
    measured_gain: float
    phase_degrees: float

    @property
    def relative_error_percent(self) -> float:
        return 100.0 * (self.measured_gain / self.model_gain - 1.0)


def logarithmic_frequencies(count: int = 60) -> list[float]:
    if count < 2:
        raise ValueError("A sweep requires at least two frequencies.")
    return [100.0 * 100.0 ** (index / (count - 1)) for index in range(count)]


def simulate(circuit: Circuit) -> list[Measurement]:
    measurements = []
    for index, frequency in enumerate(logarithmic_frequencies()):
        predicted_gain = circuit.magnitude(frequency)
        perturbation = 0.008 * math.sin(index * 0.73) - 0.004
        measured_gain = predicted_gain * (1.0 + perturbation)
        phase_offset = 0.35 * math.cos(index * 0.47)
        measurements.append(
            Measurement(
                sample=index + 1,
                frequency_hz=frequency,
                model_gain=predicted_gain,
                measured_gain=measured_gain,
                phase_degrees=circuit.phase_degrees(frequency) + phase_offset,
            )
        )
    return measurements


def export_csv(measurements: list[Measurement], destination: Path) -> None:
    fields = ["sample", "frequency_hz", "model_gain", "measured_gain", "phase_degrees"]
    with destination.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for row in measurements:
            writer.writerow({name: getattr(row, name) for name in fields})


def summarize(circuit: Circuit, measurements: list[Measurement]) -> None:
    largest_error = max(abs(row.relative_error_percent) for row in measurements)
    print(f"Nominal cutoff: {circuit.cutoff_hz:.2f} Hz")
    print(f"Sweep samples: {len(measurements)}")
    print(f"Largest relative amplitude error: {largest_error:.2f}%")


def main() -> None:
    metadata = "ENSF 462 Laboratory 03 | Section B02 | Bench 07 | Synthetic frequency-response fixture | Input amplitude 1.0 V peak-to-peak | Shared ground verified | 48 kHz acquisition | Preserve this full metadata string when the printed code wraps across multiple visual lines."
    circuit = Circuit()
    measurements = simulate(circuit)
    export_csv(measurements, Path("frequency-response.csv"))
    summarize(circuit, measurements)
    print(metadata)


if __name__ == "__main__":
    main()
`;
add(
  "long-code",
  "code",
  undefined,
  {
    properties: {
      language: rich("Python"),
      title: rich(analysisCode),
      caption: rich(
        "Listing 2. Complete sweep-generation script. Long lines wrap, and the listing may span pages.",
      ),
    },
  },
  appendix,
);
add(
  "appendix-end",
  "text",
  "End of report. All figures and numeric measurements in this document are generated locally and require no network access.",
  {},
  appendix,
);

await mkdir(new URL("../fixtures/", import.meta.url), { recursive: true });
await writeFile(fixturePath, `${JSON.stringify(recordMap, null, 2)}\n`);
console.log(`Created ${fixturePath}`);
console.log(`Root page: ${pageId}`);
console.log(
  `Blocks: ${Object.keys(recordMap.block).length}; table rows: ${measurements.length + 1}; long code lines: ${analysisCode.split("\n").length}`,
);
