import { format } from 'date-fns';
import type { jsPDF as JsPDF } from 'jspdf';
import { formatNumber, fromMinor, type PeriodSummary, type Platform, type PlatformStats } from '../domain';
import type { ExpenseEntity, RideEntity } from './entities';

/** Fonturi TTF (base64) cu diacriticele românești; fonturile standard PDF nu au ș și ț. */
export interface PdfFonts {
  regular: string;
  bold: string;
}

export interface PdfReportInput {
  title: string;
  periodLabel: string;
  currency: string;
  generatedAt: Date;
  summary: PeriodSummary;
  platforms: Record<Platform, PlatformStats>;
  rides: readonly RideEntity[];
  expenses: readonly ExpenseEntity[];
  expenseLabels: Record<string, string>;
}

const PLATFORM_LABEL: Record<Platform, string> = { uber: 'Uber', bolt: 'Bolt' };

/** Încarcă fonturile din aplicație (fișiere locale, merg și offline). */
export async function loadPdfFonts(): Promise<PdfFonts> {
  const [regularUrl, boldUrl] = await Promise.all([
    import('@expo-google-fonts/barlow/400Regular/Barlow_400Regular.ttf?url').then((m) => m.default as string),
    import('@expo-google-fonts/barlow/600SemiBold/Barlow_600SemiBold.ttf?url').then((m) => m.default as string),
  ]);
  const toBase64 = async (url: string) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const [regular, bold] = await Promise.all([toBase64(regularUrl), toBase64(boldUrl)]);
  return { regular, bold };
}

/** Raport PDF A4 pentru o perioadă. Bibliotecile se încarcă doar când e nevoie. */
export async function buildPdfReport(input: PdfReportInput, fonts: PdfFonts): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc: JsPDF = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Barlow-Regular.ttf', fonts.regular);
  doc.addFont('Barlow-Regular.ttf', 'Barlow', 'normal');
  doc.addFileToVFS('Barlow-SemiBold.ttf', fonts.bold);
  doc.addFont('Barlow-SemiBold.ttf', 'Barlow', 'bold');
  doc.setFont('Barlow', 'normal');

  const c = input.currency;
  const m = (minor: number) => `${formatNumber(fromMinor(minor))} ${c}`;
  const s = input.summary;
  const margin = 14;
  const ink: [number, number, number] = [18, 24, 32];
  const muted: [number, number, number] = [91, 104, 120];
  const brand: [number, number, number] = [31, 91, 224];

  doc.setFont('Barlow', 'bold').setFontSize(20).setTextColor(...ink).text(input.title, margin, 20);
  doc.setFont('Barlow', 'normal').setFontSize(11).setTextColor(...muted);
  doc.text(`Perioada: ${input.periodLabel}`, margin, 27);
  doc.text(`Generat: ${format(input.generatedAt, 'dd.MM.yyyy HH:mm')}`, margin, 32);

  const heroColor: [number, number, number] = s.periodProfitMinor < 0 ? [201, 48, 58] : ink;
  doc.setFont('Barlow', 'bold').setFontSize(28).setTextColor(...heroColor);
  doc.text(m(s.periodProfitMinor), margin, 47);
  doc.setFont('Barlow', 'normal').setFontSize(10).setTextColor(...muted);
  doc.text('Profit operațional estimat. Nu este profit contabil sau fiscal.', margin, 53);

  const table = (startY: number, head: string[], body: (string | number)[][], rightFrom = 1) => {
    autoTable(doc, {
      startY,
      head: [head],
      body: body.map((r) => r.map(String)),
      margin: { left: margin, right: margin },
      styles: { font: 'Barlow', fontSize: 9, cellPadding: 1.8, textColor: ink, lineColor: [220, 225, 231], lineWidth: 0.1 },
      headStyles: { font: 'Barlow', fontStyle: 'bold', fillColor: brand, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [244, 246, 248] },
      columnStyles: Object.fromEntries(head.map((_, i) => [i, { halign: i >= rightFrom ? 'right' : 'left' }])),
    });
    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };

  let y = table(60, ['Indicator', 'Valoare'], [
    ['Venituri (cu bacșiș și bonus)', m(s.grossIncomeMinor)],
    ['Comisioane', m(s.commissionMinor)],
    ['Energie estimată', m(s.energyEstimatedMinor)],
    ['Uzură și mentenanță', m(s.wearMinor)],
    ['Cheltuieli introduse', m(s.expensesMinor)],
    ['Costuri fixe alocate', m(s.fixedCostsAllocatedMinor)],
    ['Costuri totale', m(s.totalCostsMinor)],
    ['Profit operațional estimat', m(s.periodProfitMinor)],
    ...(s.taxReserveMinor > 0 ? [['Rezervă pentru taxe (setată de tine)', m(s.taxReserveMinor)], ['Disponibil după rezervă', m(s.afterReserveMinor)]] : []),
    ['Număr curse', String(s.rideCount)],
    ['Kilometri', formatNumber(s.km, 0)],
    ['Ore cu curse', formatNumber(s.hours, 1)],
    ['Profit mediu pe cursă', s.avgProfitPerRideMinor === null ? '—' : m(s.avgProfitPerRideMinor)],
    ['Profit mediu pe km (din curse)', `${formatNumber(s.profitPerKm)} ${c}/km`],
    ['Profit mediu pe oră (din curse)', `${formatNumber(s.profitPerHour)} ${c}/oră`],
    ...(s.energyPaidMinor > 0 ? [['Combustibil/încărcare plătit (doar comparație)', m(s.energyPaidMinor)]] : []),
  ]);

  y = table(y, ['Platformă', 'Curse', 'Profit', `${c}/oră`, `${c}/km`, 'Comision mediu'],
    (['uber', 'bolt'] as Platform[]).map((p) => {
      const x = input.platforms[p];
      return [PLATFORM_LABEL[p], x.rideCount, m(x.profitMinor), formatNumber(x.profitPerHour), formatNumber(x.profitPerKm), x.avgCommissionPct === null ? '—' : `${formatNumber(x.avgCommissionPct, 1)}%`];
    }));

  if (input.rides.length > 0) {
    doc.setFont('Barlow', 'bold').setFontSize(13).setTextColor(...ink).text('Curse', margin, y);
    y = table(y + 3, ['Data', 'Platformă', 'Sumă', 'Km', 'Min', 'Profit', `${c}/oră`],
      [...input.rides].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()).map((r) => [
        format(r.startedAt, 'dd.MM HH:mm'),
        PLATFORM_LABEL[r.platform],
        formatNumber(fromMinor(r.result.grossIncomeMinor)),
        formatNumber(r.result.totalKm, 1),
        formatNumber(r.result.totalMin, 0),
        formatNumber(fromMinor(r.result.profitMinor)),
        formatNumber(r.result.profitPerHour),
      ]), 2);
  }

  if (input.expenses.length > 0) {
    doc.setFont('Barlow', 'bold').setFontSize(13).setTextColor(...ink).text('Cheltuieli', margin, y);
    table(y + 3, ['Data', 'Categorie', 'Sumă', 'Notă'],
      [...input.expenses].sort((a, b) => a.date.getTime() - b.date.getTime()).map((e) => [
        format(e.date, 'dd.MM.yyyy'),
        input.expenseLabels[e.category] ?? e.category,
        m(e.amountMinor),
        e.note ?? '',
      ]), 2);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('Barlow', 'normal').setFontSize(8).setTextColor(...muted);
    doc.text(`Drivio · pagina ${i} din ${pages} · estimări operaționale, nu documente contabile`, margin, 290);
  }
  return doc.output('blob');
}
