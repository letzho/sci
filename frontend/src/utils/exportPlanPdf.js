import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { productLabel } from '../components/ui.jsx';

const DISCLAIMER =
  'This document is for illustration and discussion purposes only. It is not financial advice, not a binding quote, and does not constitute a recommendation to purchase any product.';

export function exportPlanToPdf({ customer, portfolio, plan, agentName }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = margin;

  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text('Client Financial Plan', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Prepared for: ${customer?.name || 'Client'}`, margin, y);
  y += 5;
  if (agentName) {
    doc.text(`Representative: ${agentName}`, margin, y);
    y += 5;
  }
  doc.text(`Generated: ${new Date().toLocaleDateString('en-SG')}`, margin, y);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Client profile', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const profileLines = [
    `Age: ${portfolio?.age ?? '—'}`,
    `Health: ${portfolio?.healthCondition || customer?.healthCondition || 'Not recorded'}`,
    `Policies on file: ${portfolio?.policyCount ?? customer?.policies?.length ?? 0}`,
    `Total annual premium: ${portfolio?.totalAnnualPremium > 0 ? `S$${portfolio.totalAnnualPremium.toLocaleString('en-SG')}` : '—'}`,
  ];
  profileLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  if (customer?.policies?.length) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Current policies', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Product', 'Policy no.', 'Premium', 'Sum assured']],
      body: customer.policies.map((p) => [
        productLabel(p.productType),
        p.policyNumber,
        p.premium ? `S$${p.premium}/${p.premiumFreq || 'mo'}` : '—',
        p.coverage?.sumAssured ? `S$${Number(p.coverage.sumAssured).toLocaleString('en-SG')}` : '—',
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (plan?.goals?.length) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Goals', margin, y);
    y += 6;
    doc.setFontSize(10);
    plan.goals.forEach((g) => {
      doc.text(`• ${g}`, margin + 2, y);
      y += 5;
    });
    y += 4;
  }

  const selected = (plan?.proposedProducts || []).filter((p) => p.selected);
  if (selected.length) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Proposed enhancements', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Product', 'Action', 'Priority', 'Rationale']],
      body: selected.map((p) => [p.label, p.action === 'enhance' ? 'Enhance' : 'Review', p.priority || '—', p.reason || '']),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellWidth: 'wrap' },
      columnStyles: { 3: { cellWidth: 70 } },
      headStyles: { fillColor: [37, 99, 235] },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (plan?.coverageGap) {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.text('Coverage gap analysis', margin, y);
    y += 6;
    doc.setFontSize(10);
    const cg = plan.coverageGap;
    [
      `Recommended coverage: S$${Number(cg.recommendedCoverage || 0).toLocaleString('en-SG')}`,
      `Existing coverage: S$${Number(cg.existingCoverage || 0).toLocaleString('en-SG')}`,
      `Gap: S$${Number(cg.coverageGap || 0).toLocaleString('en-SG')}`,
    ].forEach((line) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 4;
  }

  if (plan?.notes?.trim()) {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.text('Notes', margin, y);
    y += 6;
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(plan.notes, 180);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 4;
  }

  if (plan?.actionItems?.length) {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.text('Next steps', margin, y);
    y += 6;
    doc.setFontSize(10);
    plan.actionItems.forEach((item) => {
      doc.text(`• ${item}`, margin + 2, y);
      y += 5;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(DISCLAIMER, margin, 287, { maxWidth: 182 });
  }

  const safeName = (customer?.name || 'client').replace(/\s+/g, '-').toLowerCase();
  doc.save(`financial-plan-${safeName}.pdf`);
}
