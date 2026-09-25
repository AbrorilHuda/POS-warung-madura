import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Warungku" }];
}

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 text-center">
      <p className="text-sm text-neutral-500">
        Halaman ini khusus menampilkan invoice hasil scan QR dari struk
        belanja.
      </p>
    </div>
  );
}
