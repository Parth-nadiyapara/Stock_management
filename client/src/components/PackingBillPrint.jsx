function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Pure presentational "paper". Used two places: inside the on-screen
// preview modal (Packing.jsx, wrapped in a bordered card), and
// inside PrintPortal for the actual print output. Visibility for
// print vs screen is handled entirely by index.css / PrintPortal,
// not by this component - it just renders the bill.
export default function PackingBillPrint({ bill }) {
  if (!bill) return null;

  return (
    <div className="mx-auto w-full max-w-xl overflow-x-auto bg-white p-5 text-ink sm:p-8">
      <div className="flex items-start justify-between gap-3 border-b border-ink/20 pb-4">
        <div>
          <p className="text-lg font-semibold">Packing Bill</p>
          <p className="text-sm text-ink-soft">Plastic Material Manager</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-semibold">{bill.billNumber}</p>
          <p className="text-sm text-ink-soft">{formatDate(bill.date)}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Client</p>
        <p className="mt-1 break-words text-base font-medium">{bill.client}</p>
      </div>

      <table className="mt-6 w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-ink/20 text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2">Product</th>
            <th className="py-2">Size</th>
            <th className="py-2">Quantity</th>
            <th className="py-2 text-right">Weight (KG)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-ink/10">
            <td className="py-3">{bill.product}</td>
            <td className="py-3">{bill.size}</td>
            <td className="py-3">{bill.quantity ? `${bill.quantity} rolls` : '—'}</td>
            <td className="py-3 text-right font-medium">{bill.weightKg}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-10 flex justify-between gap-4 text-sm text-ink-soft">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Prepared by</p>
          <p className="mt-1">{bill.createdBy}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Signature</p>
          <p className="mt-8 border-t border-ink/30 pt-1">&nbsp;</p>
        </div>
      </div>
    </div>
  );
}
