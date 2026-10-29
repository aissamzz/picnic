import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

Font.register({
  family: "Cairo",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf/fonts/Cairo-400.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "lib/pdf/fonts/Cairo-700.ttf"), fontWeight: 700 },
  ],
});

const INK = "#1C1B19";
const MUTED = "#5E5A53";
const PRIMARY = "#E5245E";

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Cairo", fontSize: 11, color: INK },
  brand: { fontSize: 22, fontWeight: 700, color: PRIMARY },
  title: { fontSize: 16, fontWeight: 700, marginTop: 24 },
  meta: { color: MUTED, marginTop: 2 },
  table: { marginTop: 24, borderTopWidth: 1, borderColor: "#E7E3DA" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderColor: "#E7E3DA" },
  label: { color: MUTED },
  value: { fontWeight: 700 },
  total: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, fontSize: 14, fontWeight: 700 },
  stamp: { marginTop: 24, alignSelf: "flex-start", borderWidth: 2, borderColor: PRIMARY, color: PRIMARY, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, fontWeight: 700 },
  footer: { position: "absolute", bottom: 40, left: 48, right: 48, textAlign: "center", color: MUTED, fontSize: 9 },
});

export type ReceiptData = {
  labels: Record<"title" | "number" | "restaurant" | "reference" | "plan" | "method" | "period" | "amount" | "paid" | "issuedOn" | "footer", string>;
  number: string;
  restaurant: string;
  reference: string;
  plan: string;
  method: string;
  period: string;
  amount: string;
};

/** One-page A4 payment receipt, generated on demand for approved payments. */
export async function receiptPdf(d: ReceiptData): Promise<Buffer> {
  const rows: [string, string][] = [
    [d.labels.restaurant, d.restaurant],
    [d.labels.reference, d.reference],
    [d.labels.plan, d.plan],
    [d.labels.method, d.method],
    [d.labels.period, d.period],
  ];
  return renderToBuffer(
    <Document title={`${d.labels.title} ${d.number}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>Liinky</Text>
        <Text style={s.title}>{d.labels.title}</Text>
        <Text style={s.meta}>
          {d.labels.number} {d.number} · {d.labels.issuedOn}
        </Text>
        <View style={s.table}>
          {rows.map(([k, v]) => (
            <View key={k} style={s.row}>
              <Text style={s.label}>{k}</Text>
              <Text style={s.value}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={s.total}>
          <Text>{d.labels.amount}</Text>
          <Text>{d.amount}</Text>
        </View>
        <Text style={s.stamp}>{d.labels.paid}</Text>
        <Text style={s.footer}>{d.labels.footer}</Text>
      </Page>
    </Document>,
  );
}
