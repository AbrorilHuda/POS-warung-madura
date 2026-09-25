import type { Route } from "./+types/tidak-ditemukan";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Invoice Belum Tersedia - Warungku" }];
}

export default function TidakDitemukan({ params }: Route.ComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 px-4 text-center">
      <div className="max-w-sm rounded-lg bg-white p-6 shadow-sm">
        <p className="mb-2 text-lg font-semibold text-neutral-900">
          Invoice sedang diproses
        </p>
        <p className="text-sm text-neutral-500">
          Invoice <span className="font-mono">{params.id}</span> belum
          tersinkron dari warung. Coba muat ulang halaman ini beberapa saat
          lagi.
        </p>
      </div>
    </div>
  );
}
