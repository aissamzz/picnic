import "server-only";
import path from "node:path";
import { Document, Font, Image, Page, Polygon, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

// Static TTFs: fontkit can't embed variable WOFF2. Cairo covers Latin + Arabic.
Font.register({
  family: "Cairo",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Cairo-400.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Cairo-700.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const INK = "#1C1B19";
const CLAY = "#9C3D24";
const SAND = "#F6F4EF";

const s = StyleSheet.create({
  page: { padding: 24, fontFamily: "Cairo", color: INK, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "48.5%", height: 250, borderWidth: 1, borderColor: "#E7E3DA", borderStyle: "dashed", borderRadius: 10, overflow: "hidden", alignItems: "center" },
  name: { fontSize: 13, fontWeight: 700, marginTop: 8 },
  qr: { width: 120, height: 120, marginTop: 4 },
  table: { fontSize: 20, fontWeight: 700, marginTop: 2 },
  line: { fontSize: 9, color: "#5E5A53" },
});

/** Thin Kabyle band (triangles over a checker strip) for printed stands. */
function Band() {
  const tri = Array.from({ length: 22 });
  return (
    <Svg width="100%" height={12} viewBox="0 0 264 12" preserveAspectRatio="none">
      <Rect x={0} y={0} width={264} height={12} fill={SAND} />
      {tri.map((_, i) => (
        <Polygon key={i} points={`${i * 12},8 ${i * 12 + 6},1 ${i * 12 + 12},8`} fill={i % 2 ? INK : CLAY} />
      ))}
      {tri.map((_, i) => (
        <Rect key={`c${i}`} x={i * 12 + (i % 2) * 6} y={9} width={6} height={3} fill={INK} />
      ))}
    </Svg>
  );
}

export type TableCard = { label: string; url: string };

export async function tableCardsPdf(opts: { restaurant: string; cards: TableCard[]; lines: string[] }): Promise<Buffer> {
  const qrs = await Promise.all(opts.cards.map((c) => QRCode.toDataURL(c.url, { errorCorrectionLevel: "M", margin: 1, width: 480, color: { dark: INK, light: "#FFFFFF" } })));
  const pages: TableCard[][] = [];
  for (let i = 0; i < opts.cards.length; i += 6) pages.push(opts.cards.slice(i, i + 6));
  const doc = (
    <Document title={`${opts.restaurant} · QR`}>
      {pages.map((cards, p) => (
        <Page key={p} size="A4" style={s.page}>
          {cards.map((c, i) => (
            <View key={c.url} style={s.card} wrap={false}>
              <Band />
              <Text style={s.name}>{opts.restaurant}</Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
              <Image src={qrs[p * 6 + i]} style={s.qr} />
              <Text style={s.table}>{c.label}</Text>
              {opts.lines.map((l) => (
                <Text key={l} style={[s.line, { textAlign: "center" }]}>
                  {l}
                </Text>
              ))}
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
