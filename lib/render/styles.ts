import { paperGeometry, type ReportSettings } from "../settings";

export const blockStyles = `
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;background:#fff;color:#242424}
.report{font-family:"Report Serif",Georgia,serif;font-size:11pt;line-height:1.55;overflow-wrap:anywhere}
.report h1,.report h2,.report h3{line-height:1.23;color:var(--heading-color,#191919);font-weight:600;break-after:avoid}
.report h1{font-size:25pt;letter-spacing:-.025em;margin:1.3em 0 .55em}
.report h2{font-size:17pt;margin:1.5em 0 .5em}.report h3{font-size:12.5pt;margin:1.3em 0 .45em}
.report p{margin:.65em 0;orphans:3;widows:3}.report a{color:inherit;text-decoration:underline;text-underline-offset:.15em}
.report ul,.report ol{margin:.6em 0;padding-left:1.6em}.report li{padding-left:.18em;margin:.2em 0}
.report li>p:first-child{margin-top:0}.report li>p:last-child{margin-bottom:0}
.report blockquote{margin:1em 0;border-left:2px solid #a4a29d;padding:.15em 1.1em;color:#57544f}
.report figure{margin:1.2em 0}.report img{max-width:100%;height:auto;object-fit:contain}
.report figure>img{display:block;margin:auto;max-height:7in}.report figcaption{font-size:9pt;color:#77746d;margin-top:.5em;text-align:center;break-before:avoid}
.report code{font-family:"Report Mono","Noto Sans Symbols 2",monospace;font-size:.82em;background:#f2f1ee;border-radius:3px;padding:.13em .3em}
.report pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;margin:0;padding:14px 16px;line-height:1.55}
.report pre code{white-space:pre-wrap;font-size:8.5pt;background:transparent;padding:0;word-break:break-word}
.report table{width:100%;border-collapse:collapse;font-size:.9em;margin:1em 0;table-layout:fixed}
.report th,.report td{border:1px solid #dbd9d4;padding:.48em .7em;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.report th{background:#f1f0ec;font-weight:600}.report thead{display:table-header-group}.report tr{break-inside:avoid}
.report hr{border:0;border-top:1px solid #dcd9d2;margin:2em 0}
.report .katex-display{margin:1.1em 0;overflow-wrap:normal}.report .katex{font-size:1.05em}
.report details{margin:.8em 0}.report summary{font-weight:600}.report .report-placeholder{background:#f5f4f1;border:1px dashed #d5d2cc;border-radius:5px;color:#77746d;padding:12px 14px;font:10pt "Report Sans",sans-serif;margin:1em 0}
.report-code{border:1px solid #e2e0da;border-radius:7px;background:#f7f6f3;overflow:hidden}.report-code pre.shiki{background:transparent!important}.report-code-short{break-inside:avoid}.report-code-label{padding:7px 16px;border-bottom:1px solid #e5e3dd;color:#79766e;font:8pt "Report Sans",sans-serif}.report-code .report-caption{padding:0 14px 12px}.report-placeholder strong,.report-placeholder span{display:block}.report-placeholder span{margin-top:3px;font-size:9pt}
.report-callout{display:flex;gap:12px;padding:15px 17px;margin:1em 0;border-radius:7px;background:#f3f2ef;break-inside:avoid}.report-callout-icon{font-family:"Apple Color Emoji","Noto Color Emoji",sans-serif;font-size:17px;flex-shrink:0}.report-callout-icon-image{width:22px;height:22px}.report-callout-content{min-width:0;flex:1}.report-callout-content>p:first-child{margin-top:0}.report-callout-content>p:last-child{margin-bottom:0}
.report-toggle-title{font-weight:600}.report-toggle-marker{padding-right:7px}.report-toggle-content{padding-left:18px}.report-todo{margin:.4em 0}.report-todo-line{display:flex;align-items:baseline;gap:9px}.report-checkbox{font-family:"Report Sans",sans-serif}.report-todo-checked .report-todo-line>span:last-child{color:#77746d}.report-todo>.report-todo{margin-left:22px}
.report-columns{display:flex;gap:24px;align-items:flex-start;margin:1em 0}.report-column{flex:1;min-width:0}.report-column>:first-child{margin-top:0}.report-bookmark{display:block;border:1px solid #e0ded8;border-radius:5px;padding:11px 14px;margin:1em 0;text-decoration:none!important;break-inside:avoid}.report-bookmark-title{display:block;font-weight:600}.report-bookmark-url{display:block;color:#77746d;font-size:8.5pt;margin-top:3px}
.report-color-gray{color:#73716d}.report-color-brown{color:#895e47}.report-color-orange{color:#a86425}.report-color-yellow{color:#8b7423}.report-color-green{color:#39724c}.report-color-teal{color:#397573}.report-color-blue{color:#3d6796}.report-color-purple{color:#755396}.report-color-pink{color:#975974}.report-color-red{color:#ac4942}
.report-color-gray_background{background:#f0efec}.report-color-brown_background{background:#f3eae4}.report-color-orange_background{background:#fcf0e3}.report-color-yellow_background{background:#fbf5dd}.report-color-green_background{background:#eaf3e8}.report-color-teal_background{background:#e7f2ef}.report-color-blue_background{background:#eaf1f9}.report-color-purple_background{background:#f0eaf6}.report-color-pink_background{background:#f8eaf0}.report-color-red_background{background:#faeae7}
`;

function cssString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("<", "\\3c ").replaceAll("\n", " ").replaceAll("\r", " ")}"`;
}

export function printStyles(settings: ReportSettings): string {
  const { width, height, margin } = paperGeometry(settings);
  const font = {
    serif: '"Report Serif","Noto Sans Symbols 2",Georgia,serif',
    sans: '"Report Sans","Noto Sans Symbols 2",Arial,sans-serif',
    system: 'Arial,Helvetica,"Noto Sans Symbols 2",sans-serif',
  }[settings.font];
  const center =
    settings.pageNumbers && settings.pageNumberPosition === "center"
      ? "counter(page)"
      : "none";
  const right =
    settings.pageNumbers && settings.pageNumberPosition === "right"
      ? "counter(page)"
      : "none";
  return `
@page{size:${width}in ${height}in;margin:${margin}in;@top-left{content:${settings.runningHeader ? cssString(settings.runningHeader) : "none"};font-family:"Report Sans",sans-serif;font-size:8pt;color:#77746d}@bottom-center{content:${center};font-family:"Report Sans",sans-serif;font-size:9pt;color:#77746d}@bottom-right{content:${right};font-family:"Report Sans",sans-serif;font-size:9pt;color:#77746d}}
@page cover{counter-reset:page 0;@top-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report{font-family:${font};font-size:${settings.fontSize}pt;line-height:${settings.lineHeight};--heading-color:${settings.headingColor}}
.report-section{page:body;break-before:page;display:flow-root}.report-section:first-child{break-before:auto}.report-section>h1:first-child,.report-section>h2:first-child,.report-section>h3:first-child{margin-top:0}
.report-cover{page:cover;height:${height - margin * 2}in;display:flex;align-items:center;justify-content:center;text-align:center;break-after:page;break-inside:avoid}
.report-cover-content{width:100%;display:flow-root}.report-cover h1,.report-cover h2,.report-cover h3,.report-cover p,.report-cover li,.report-cover figcaption{text-align:center}.report-cover-content>:first-child{margin-top:0}.report-cover-content>:last-child{margin-bottom:0}
.report-cover ul,.report-cover ol{list-style-position:inside;padding-left:0}.report-cover li{padding-left:0}.report-cover .report-list-text{display:inline}.report-cover figure{margin:1.5em auto;max-width:90%}.report-cover img{max-height:2.4in}.report-cover .report-columns{justify-content:center}.report-cover .report-todo-line{justify-content:center}
.report-divider{display:none}.report-image{break-inside:avoid}.report-code{overflow:visible;box-decoration-break:clone;-webkit-box-decoration-break:clone}.report-code pre{orphans:3;widows:3}.report-code-label{break-after:avoid}.report-caption{break-before:avoid}.report-callout{break-inside:avoid}.report-table tr{break-inside:avoid;page-break-inside:avoid}.report-table thead{display:table-header-group}.report-table{break-inside:auto}.report-equation{break-inside:avoid}
.report-callout-icon{font-family:"Noto Emoji",sans-serif}.report-checkbox{font-family:"Noto Emoji","Report Sans",sans-serif}.report-code code{font-variant-ligatures:none}
${settings.h1PageBreak ? ".report-section h1{break-before:page}.report-section>h1:first-child{break-before:auto}" : ""}
${settings.calloutColors === "grayscale" ? ".report-callout{background:#f0f0ee!important;color:#333!important}.report-callout [class*=report-color-]{color:inherit!important;background:transparent!important}" : ""}
${settings.codeTheme === "grayscale" ? ".report-code .shiki span{color:#333!important}.report-code{background:#f3f3f1}" : ""}
@media screen{body{background:#eeede9;padding:28px 0}.report{width:${width}in;margin:auto}.report-cover,.report-section{background:#fff;padding:${margin}in;margin-bottom:24px;min-height:${height}in}.report-cover{height:${height}in}.report-cover-content{max-height:${height - margin * 2}in}.report-section{box-shadow:0 0 0 1px #dddcd6}}
@media print{body{padding:0}.report{width:auto;max-width:none;margin:0}.report-cover,.report-section{margin:0;padding:0}.report-cover:last-child{break-after:auto}}
`;
}
