import { useEffect, useRef, useState } from "react";
import { redirect } from "react-router";
import type { Route } from "./+types/invoice";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Invoice - Warungku" }];
}

// TODO: ganti dengan fetch ke API server pusat, contoh:
// const res = await fetch(`${process.env.API_URL}/api/invoice/${params.id}`);
// if (res.status === 404) throw redirect(`/invoice/${params.id}/tidak-ditemukan`);
// if (!res.ok) throw new Response("Gagal memuat invoice", { status: 500 });
// return res.json();
export async function loader({ params }: Route.LoaderArgs) {
  // --- MOCK DATA sementara, hapus setelah API tersedia ---
  const mock = {
    invoiceCode: params.id,
    storeName: "Warung Madura Sinar Jaya",
    storeAddress: "Jl. Merdeka No. 12, Surabaya",
    createdAt: new Date().toISOString(),
    items: [
      { name: "Mie Sedaap Ayam Bawang", unit: "pcs", qty: 3, price: 3000 },
      { name: "Rokok Sampoerna Mild", unit: "pack", qty: 1, price: 25000 },
      { name: "Aqua 600ml", unit: "pcs", qty: 2, price: 4000 },
    ],
  };

  if (mock.invoiceCode === "not-found") {
    throw redirect(`/invoice/${params.id}/tidak-ditemukan`);
  }
  // --- akhir mock data ---

  return mock;
}

export default function Invoice({ loaderData }: Route.ComponentProps) {
  const { invoiceCode, storeName, storeAddress, createdAt, items } =
    loaderData;

  const invoiceRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);

  const total = items.reduce(
    (sum: number, item: (typeof items)[number]) => sum + item.price * item.qty,
    0,
  );

  const invoiceUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://warungku.my.id/invoice/${invoiceCode}`;

  useEffect(() => {
    // Generate QR code yang mengarah ke URL invoice ini sendiri —
    // supaya kalau gambar invoice di-download/diteruskan, penerima
    // tetap bisa scan ulang dan verifikasi ke sumber aslinya.
    import("qrcode").then((QRCode) => {
      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, invoiceUrl, {
          width: 120,
          margin: 1,
        });
      }
    });
  }, [invoiceUrl]);

  async function handleDownload() {
    if (!invoiceRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(invoiceRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `invoice-${invoiceCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-neutral-100 px-4 py-8">
      <div
        ref={invoiceRef}
        className="w-full max-w-sm rounded-lg bg-white p-6 font-mono text-sm text-neutral-800 shadow-sm"
      >
        {/* Header toko */}
        <div className="mb-4 text-center">
          <p className="text-base font-bold">{storeName}</p>
          <p className="text-xs text-neutral-500">{storeAddress}</p>
        </div>

        <div className="mb-3 border-t border-dashed border-neutral-300" />

        <div className="mb-3 flex justify-between text-xs text-neutral-500">
          <span>No. Invoice</span>
          <span>{invoiceCode}</span>
        </div>
        <div className="mb-3 flex justify-between text-xs text-neutral-500">
          <span>Tanggal</span>
          <span>
            {new Date(createdAt).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>

        <div className="mb-3 border-t border-dashed border-neutral-300" />

        {/* Daftar item */}
        <div className="mb-3 space-y-2">
          {items.map((item: (typeof items)[number], idx: number) => (
            <div key={idx}>
              <div className="flex justify-between">
                <span>{item.name}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>
                  {item.qty} {item.unit} x{" "}
                  {item.price.toLocaleString("id-ID")}
                </span>
                <span>
                  {(item.price * item.qty).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3 border-t border-dashed border-neutral-300" />

        {/* Total */}
        <div className="mb-4 flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>Rp {total.toLocaleString("id-ID")}</span>
        </div>

        <div className="mb-3 border-t border-dashed border-neutral-300" />

        {/* QR code mengarah ke invoice ini sendiri */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <canvas ref={qrCanvasRef} />
          <p className="text-[10px] text-neutral-400">
            Scan untuk buka invoice ini
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="mt-6 w-full max-w-sm rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {downloading ? "Menyiapkan..." : "Download sebagai Gambar"}
      </button>
    </div>
  );
}
